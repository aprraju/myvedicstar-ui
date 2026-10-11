using System.ComponentModel.DataAnnotations;
using System.Globalization;
using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace MyVedicStar.LocationSearch;

public sealed class GeoNamesOptions
{
    [Required, RegularExpression("^[A-Za-z0-9_.-]{1,80}$")] public string Username { get; set; } = "";
    [Range(2, 30)] public int TimeoutSeconds { get; set; } = 10;
    [Range(1, 48)] public int SearchCacheHours { get; set; } = 24;
    [Range(1, 30)] public int CoordinateCacheDays { get; set; } = 7;
}

public sealed record LocationSuggestion(string Id, string City, string? Region, string Country,
    string CountryCode, string? PostalCode, double Latitude, double Longitude, string Source);
public sealed record LocationSearchResponse(IReadOnlyList<LocationSuggestion> Results);
public sealed record LocationReverseResponse(LocationSuggestion? Place);
public sealed record LocationTimezoneResponse(string TimeZone);

public interface ILocationSearchProvider
{
    Task<LocationSearchResponse> SearchAsync(string text, string? country, string? language, int maxRows, CancellationToken cancellationToken);
    Task<LocationSearchResponse> PostalAsync(string text, string? country, int maxRows, CancellationToken cancellationToken);
    Task<LocationReverseResponse> ReverseAsync(double latitude, double longitude, string? language, CancellationToken cancellationToken);
    Task<LocationTimezoneResponse> TimezoneAsync(double latitude, double longitude, CancellationToken cancellationToken);
}

public sealed class GeoNamesUnavailableException(int statusCode = 503, int? retryAfterSeconds = null) : Exception("Location lookup is temporarily unavailable.")
{
    public int StatusCode { get; } = statusCode;
    public int? RetryAfterSeconds { get; } = retryAfterSeconds;
}

/// <summary>HTTPS provider adapter. Stores normalized public geography in a bounded in-process cache, never logs input.</summary>
public sealed class GeoNamesLocationSearchClient(HttpClient http, IOptions<GeoNamesOptions> options) : ILocationSearchProvider, IDisposable
{
    private readonly MemoryCache cache = new(new MemoryCacheOptions { SizeLimit = 500 });
    private readonly SemaphoreSlim concurrency = new(4);
    private long nextAllowedRequest;

    public async Task<LocationSearchResponse> SearchAsync(string text, string? country, string? language, int maxRows, CancellationToken cancellationToken)
    {
        var parameters = new Dictionary<string, string?> { [text.Contains(',') ? "q" : "name_startsWith"] = text,
            ["featureClass"] = "P", ["country"] = country, ["lang"] = language, ["maxRows"] = maxRows.ToString(CultureInfo.InvariantCulture), ["style"] = "LONG" };
        var data = await ReadAsync("searchJSON", parameters, TimeSpan.FromHours(options.Value.SearchCacheHours), cancellationToken);
        var results = Places(data, "geonames", "city", maxRows);
        if (results.Count == 0 && parameters.Remove("name_startsWith"))
        {
            parameters["q"] = text;
            data = await ReadAsync("searchJSON", parameters, TimeSpan.FromHours(options.Value.SearchCacheHours), cancellationToken);
            results = Places(data, "geonames", "city", maxRows);
        }
        return new(results);
    }

    public async Task<LocationSearchResponse> PostalAsync(string text, string? country, int maxRows, CancellationToken cancellationToken)
    {
        // GeoNames stores only the FSA for Canada. Apply the documented reduction only when the user chose Canada.
        var code = country == "CA" && text.Replace(" ", "").Length > 3 ? text.Replace(" ", "")[..3] : text;
        var data = await ReadAsync("postalCodeSearchJSON", new() { ["postalcode"] = code,
            ["country"] = country, ["maxRows"] = maxRows.ToString(CultureInfo.InvariantCulture) }, TimeSpan.FromHours(options.Value.SearchCacheHours), cancellationToken);
        return new(Places(data, "postalCodes", "postal", maxRows));
    }

    public async Task<LocationReverseResponse> ReverseAsync(double latitude, double longitude, string? language, CancellationToken cancellationToken)
    {
        var data = await ReadAsync("findNearbyPlaceNameJSON", new() { ["lat"] = Number(latitude), ["lng"] = Number(longitude),
            ["lang"] = language, ["maxRows"] = "1", ["style"] = "LONG" }, TimeSpan.FromDays(options.Value.CoordinateCacheDays), cancellationToken);
        return new(Places(data, "geonames", "city", 1).FirstOrDefault());
    }

    public async Task<LocationTimezoneResponse> TimezoneAsync(double latitude, double longitude, CancellationToken cancellationToken)
    {
        var data = await ReadAsync("timezoneJSON", new() { ["lat"] = Number(latitude), ["lng"] = Number(longitude) },
            TimeSpan.FromDays(options.Value.CoordinateCacheDays), cancellationToken);
        var zone = Text(data, "timezoneId");
        if (string.IsNullOrWhiteSpace(zone)) throw new GeoNamesUnavailableException();
        try { _ = TimeZoneInfo.FindSystemTimeZoneById(zone); }
        catch (TimeZoneNotFoundException) { throw new GeoNamesUnavailableException(); }
        catch (InvalidTimeZoneException) { throw new GeoNamesUnavailableException(); }
        return new(zone);
    }

    private async Task<JsonElement> ReadAsync(string endpoint, Dictionary<string, string?> parameters, TimeSpan lifetime, CancellationToken cancellationToken)
    {
        var username = options.Value.Username.Trim();
        if (username.Length == 0 || username.Equals("demo", StringComparison.OrdinalIgnoreCase)) throw new GeoNamesUnavailableException();
        parameters["username"] = username;
        var path = QueryHelpers.AddQueryString(endpoint, parameters.OrderBy(pair => pair.Key).ToDictionary());
        if (cache.TryGetValue<JsonElement>(path, out var existing)) return existing;
        var remaining = Volatile.Read(ref nextAllowedRequest) - DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        if (remaining > 0) throw new GeoNamesUnavailableException(429, (int)Math.Ceiling(remaining / 1000.0));
        await concurrency.WaitAsync(cancellationToken);
        try
        {
            if (cache.TryGetValue<JsonElement>(path, out existing)) return existing;
            using var response = await http.GetAsync(path, cancellationToken);
            if (response.StatusCode == HttpStatusCode.TooManyRequests)
            {
                var retry = response.Headers.RetryAfter?.Delta?.TotalSeconds
                    ?? (response.Headers.RetryAfter?.Date - DateTimeOffset.UtcNow)?.TotalSeconds ?? 3600;
                throw Quota((int)Math.Clamp(Math.Ceiling(retry), 1, 604800));
            }
            if (!response.IsSuccessStatusCode) throw new GeoNamesUnavailableException();
            using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellationToken));
            var root = document.RootElement;
            if (root.ValueKind != JsonValueKind.Object) throw new GeoNamesUnavailableException();
            if (root.TryGetProperty("status", out var status))
            {
                var code = status.ValueKind == JsonValueKind.Object && status.TryGetProperty("value", out var value) && value.ValueKind == JsonValueKind.Number && value.TryGetInt32(out var integer) ? integer : 0;
                if (code is 18 or 19 or 20) throw Quota(code == 19 ? 3600 : code == 20 ? 604800 : 86400);
                throw new GeoNamesUnavailableException();
            }
            var result = root.Clone();
            cache.Set(path, result, new MemoryCacheEntryOptions { AbsoluteExpirationRelativeToNow = lifetime, Size = 1 });
            return result;
        }
        catch (HttpRequestException) { throw new GeoNamesUnavailableException(); }
        catch (JsonException) { throw new GeoNamesUnavailableException(); }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested) { throw new GeoNamesUnavailableException(); }
        finally { concurrency.Release(); }
    }

    private static IReadOnlyList<LocationSuggestion> Places(JsonElement root, string property, string source, int maxRows)
    {
        if (!root.TryGetProperty(property, out var records) || records.ValueKind != JsonValueKind.Array) throw new GeoNamesUnavailableException();
        var results = new List<LocationSuggestion>();
        foreach (var place in records.EnumerateArray())
        {
            if (place.ValueKind != JsonValueKind.Object) continue;
            var city = Text(place, source == "postal" ? "placeName" : "name");
            var countryCode = Text(place, "countryCode").ToUpperInvariant();
            if (city.Length is 0 or > 160 || countryCode.Length != 2 || !countryCode.All(char.IsAsciiLetter)) continue;
            if (!Coordinate(place, "lat", -90, 90, out var lat) || !Coordinate(place, "lng", -180, 180, out var lng)) continue;
            var postal = Text(place, "postalCode");
            var id = source == "city" ? Text(place, "geonameId") : $"postal:{countryCode}:{postal}:{Number(lat)}:{Number(lng)}";
            if (id.Length is 0 or > 160) continue;
            var country = Text(place, "countryName");
            if (country.Length == 0) { try { country = new RegionInfo(countryCode).EnglishName; } catch (ArgumentException) { country = countryCode; } }
            results.Add(new(id, city, NullIfEmpty(Text(place, "adminName1")), country, countryCode, NullIfEmpty(postal), lat, lng, source));
        }
        return results.DistinctBy(place => place.Id).Take(maxRows).ToArray();
    }
    private static string Text(JsonElement value, string key) => value.TryGetProperty(key, out var property)
        ? property.ValueKind == JsonValueKind.String ? property.GetString() ?? "" : property.ValueKind == JsonValueKind.Number ? property.GetRawText() : "" : "";
    private static bool Coordinate(JsonElement place, string key, double min, double max, out double value) =>
        double.TryParse(Text(place, key), NumberStyles.Float, CultureInfo.InvariantCulture, out value) && double.IsFinite(value) && value >= min && value <= max;
    private static string? NullIfEmpty(string value) => value.Length == 0 ? null : value;
    private static string Number(double value) => value.ToString("R", CultureInfo.InvariantCulture);
    private GeoNamesUnavailableException Quota(int seconds)
    {
        Volatile.Write(ref nextAllowedRequest, DateTimeOffset.UtcNow.AddSeconds(seconds).ToUnixTimeMilliseconds());
        return new(429, seconds);
    }
    public void Dispose() { cache.Dispose(); concurrency.Dispose(); }
}

/// <summary>Additive routes; existing /locations/resolve and calculation contracts are untouched.</summary>
[ApiController]
[AllowAnonymous]
[EnableRateLimiting("public-read")]
[Route("api/v1/locations")]
public sealed class GeoNamesLocationsController(ILocationSearchProvider provider) : ControllerBase
{
    [HttpGet("search")]
    public Task<IActionResult> Search([FromQuery, Required, StringLength(120, MinimumLength = 2)] string text,
        [FromQuery, RegularExpression("^[A-Z]{2}$")] string? country, [FromQuery, RegularExpression("^[a-z]{2,3}(-[A-Za-z]{2,4})?$")] string? language,
        [FromQuery, Range(1, 8)] int maxRows = 8, CancellationToken cancellationToken = default) =>
        Execute(() => provider.SearchAsync(text.Trim().Normalize(), country, language, maxRows, cancellationToken));

    [HttpGet("postal")]
    public Task<IActionResult> Postal([FromQuery, Required, StringLength(10, MinimumLength = 2), RegularExpression("^[A-Za-z0-9 -]+$")] string text,
        [FromQuery, RegularExpression("^[A-Z]{2}$")] string? country, [FromQuery, Range(1, 8)] int maxRows = 8, CancellationToken cancellationToken = default) =>
        Execute(() => provider.PostalAsync(text.Trim().ToUpperInvariant(), country, maxRows, cancellationToken));

    [HttpGet("reverse")]
    public Task<IActionResult> Reverse([FromQuery, BindRequired, Range(-90, 90)] double latitude, [FromQuery, BindRequired, Range(-180, 180)] double longitude,
        [FromQuery, RegularExpression("^[a-z]{2,3}(-[A-Za-z]{2,4})?$")] string? language, CancellationToken cancellationToken) =>
        double.IsFinite(latitude) && double.IsFinite(longitude) ? Execute(() => provider.ReverseAsync(latitude, longitude, language, cancellationToken)) : Task.FromResult<IActionResult>(BadRequest());

    [HttpGet("timezone")]
    public Task<IActionResult> Timezone([FromQuery, BindRequired, Range(-90, 90)] double latitude, [FromQuery, BindRequired, Range(-180, 180)] double longitude, CancellationToken cancellationToken) =>
        double.IsFinite(latitude) && double.IsFinite(longitude) ? Execute(() => provider.TimezoneAsync(latitude, longitude, cancellationToken)) : Task.FromResult<IActionResult>(BadRequest());

    private async Task<IActionResult> Execute<T>(Func<Task<T>> operation)
    {
        try { return Ok(await operation()); }
        catch (GeoNamesUnavailableException error)
        {
            if (error.RetryAfterSeconds is { } seconds) Response.Headers.RetryAfter = seconds.ToString(CultureInfo.InvariantCulture);
            return Problem(statusCode: error.StatusCode, title: "Location lookup is temporarily unavailable.");
        }
    }
}

public static class GeoNamesLocationSearchRegistration
{
    /// <summary>Register in the existing API process after its public-read rate-limit policy; no extra hosted service.</summary>
    public static IServiceCollection AddGeoNamesLocationSearch(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddOptions<GeoNamesOptions>().Bind(configuration.GetSection("GeoNames")).ValidateDataAnnotations()
            .Validate(value => !value.Username.Equals("demo", StringComparison.OrdinalIgnoreCase), "Use a dedicated GeoNames account.").ValidateOnStart();
        services.AddHttpClient("myvedicstar-geonames", (provider, client) =>
        {
            client.BaseAddress = new Uri("https://secure.geonames.org/");
            client.Timeout = TimeSpan.FromSeconds(provider.GetRequiredService<IOptions<GeoNamesOptions>>().Value.TimeoutSeconds);
            client.MaxResponseContentBufferSize = 1024 * 1024;
        }).RemoveAllLoggers().ConfigurePrimaryHttpMessageHandler(() => new SocketsHttpHandler { AllowAutoRedirect = false, PooledConnectionLifetime = TimeSpan.FromMinutes(5) });
        services.AddSingleton<ILocationSearchProvider>(provider => new GeoNamesLocationSearchClient(
            provider.GetRequiredService<IHttpClientFactory>().CreateClient("myvedicstar-geonames"), provider.GetRequiredService<IOptions<GeoNamesOptions>>()));
        services.AddControllers().AddApplicationPart(typeof(GeoNamesLocationsController).Assembly);
        return services;
    }
}
