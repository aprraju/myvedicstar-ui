using System.Net;
using System.Net.Http.Headers;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Options;
using MyVedicStar.LocationSearch;

const string cities = """
{"geonames":[
{"geonameId":1,"name":"Hyderabad","adminName1":"Telangana","countryName":"India","countryCode":"IN","lat":"17.385","lng":"78.4867"},
{"geonameId":2,"name":"Hyderabad","adminName1":"Sindh","countryName":"Pakistan","countryCode":"PK","lat":"25.396","lng":"68.3578"},
{"geonameId":1,"name":"Hyderabad","countryCode":"IN","lat":"17.385","lng":"78.4867"}]}
""";
var requests = new List<Uri>();
using var handler = new FakeHandler((request, _) =>
{
    requests.Add(request.RequestUri!);
    return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(cities) });
});
using var http = new HttpClient(handler) { BaseAddress = new Uri("https://secure.geonames.org/") };
using var client = new GeoNamesLocationSearchClient(http, Options.Create(new GeoNamesOptions { Username = "test-account" }));
var results = await client.SearchAsync("Hyderabad", null, "en", 8, default);
Assert(results.Results.Count == 2 && results.Results.Select(place => place.CountryCode).SequenceEqual(["IN", "PK"]), "worldwide ambiguity and deduplication");
await client.SearchAsync("Hyderabad", null, "en", 8, default);
Assert(requests.Count == 1, "repeated provider lookup cached");
await client.SearchAsync("München", "DE", "de", 8, default);
var query = QueryHelpers.ParseQuery(requests[^1].Query);
Assert(query["name_startsWith"] == "München" && query["country"] == "DE" && query["username"] == "test-account", "Unicode and country encoded");

using var postalHandler = new FakeHandler((request, _) =>
{
    requests.Add(request.RequestUri!);
    return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("""
    {"postalCodes":[{"placeName":"Toronto","countryCode":"CA","postalCode":"M5V","lat":43.65,"lng":-79.38}]}
    """) });
});
using var postalHttp = new HttpClient(postalHandler) { BaseAddress = http.BaseAddress };
using var postalClient = new GeoNamesLocationSearchClient(postalHttp, Options.Create(new GeoNamesOptions { Username = "test-account" }));
var postal = await postalClient.PostalAsync("M5V 3L9", "CA", 8, default);
Assert(postal.Results.Single().Source == "postal" && QueryHelpers.ParseQuery(requests[^1].Query)["postalcode"] == "M5V", "documented Canadian coverage");

using var zoneHandler = new FakeHandler((request, _) =>
{
    requests.Add(request.RequestUri!);
    return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("{\"timezoneId\":\"America/Chicago\"}") });
});
using var zoneHttp = new HttpClient(zoneHandler) { BaseAddress = http.BaseAddress };
using var zoneClient = new GeoNamesLocationSearchClient(zoneHttp, Options.Create(new GeoNamesOptions { Username = "test-account" }));
Assert((await zoneClient.TimezoneAsync(30.2672, -97.7431, default)).TimeZone == "America/Chicago", "IANA timezone");
Assert(QueryHelpers.ParseQuery(requests[^1].Query)["lat"] == "30.2672", "coordinate precision preserved");

var quotaCalls = 0;
using var quotaHandler = new FakeHandler((_, _) =>
{
    quotaCalls++;
    return Task.FromResult(new HttpResponseMessage(HttpStatusCode.TooManyRequests) { Headers = { RetryAfter = new RetryConditionHeaderValue(TimeSpan.FromSeconds(120)) } });
});
using var quotaHttp = new HttpClient(quotaHandler) { BaseAddress = http.BaseAddress };
using var quotaClient = new GeoNamesLocationSearchClient(quotaHttp, Options.Create(new GeoNamesOptions { Username = "test-account" }));
for (var i = 0; i < 2; i++)
{
    try { await quotaClient.SearchAsync("Austin" + i, null, null, 8, default); throw new InvalidOperationException("Expected quota error"); }
    catch (GeoNamesUnavailableException exception) { Assert(exception.StatusCode == 429 && exception.RetryAfterSeconds >= 119, "Retry-After and cooldown"); }
}
Assert(quotaCalls == 1, "quota cooldown avoids subsequent upstream requests");

using var malformedHandler = new FakeHandler((_, _) => Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("[1,2]") }));
using var malformedHttp = new HttpClient(malformedHandler) { BaseAddress = http.BaseAddress };
using var malformedClient = new GeoNamesLocationSearchClient(malformedHttp, Options.Create(new GeoNamesOptions { Username = "test-account" }));
try { await malformedClient.SearchAsync("Austin", null, null, 8, default); throw new InvalidOperationException("Expected malformed response error"); }
catch (GeoNamesUnavailableException exception) { Assert(exception.StatusCode == 503, "malformed provider response sanitized"); }

using var cancelled = new CancellationTokenSource();
cancelled.Cancel();
try { await client.SearchAsync("Uncached", null, null, 8, cancelled.Token); throw new InvalidOperationException("Expected cancellation"); }
catch (OperationCanceledException) { Console.WriteLine("PASS cancellation"); }
Console.WriteLine("All proxy checks passed. No live GeoNames requests were made.");

static void Assert(bool condition, string name)
{
    if (!condition) throw new InvalidOperationException(name);
    Console.WriteLine("PASS " + name);
}
sealed class FakeHandler(Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> response) : HttpMessageHandler
{
    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) => response(request, cancellationToken);
}
