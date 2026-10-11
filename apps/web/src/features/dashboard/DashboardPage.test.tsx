import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createInMemoryAuthClient } from '../../shared/auth';
import { axeViolations } from '../../test/axe';
import { atInstant, storeSelectedLocation } from '../../test/location-fixtures';
import { scenarios } from '../../test/msw/handlers';
import { server } from '../../test/msw/server';
import { renderRoute } from '../../test/render';

const signedIn = () => createInMemoryAuthClient({ user: { id: 'u1', displayName: 'Asha' } });
const region = (name: string | RegExp) => screen.getByRole('region', { name });

describe('Dashboard (authenticated Today)', () => {
  it('greets the user and shows the date, paksha, tithi and location in the banner', async () => {
    await atInstant('2026-09-29T10:00:00-05:00');
    storeSelectedLocation();
    renderRoute('/dashboard', { auth: signedIn() });
    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
    // Name from the Authorize API's userinfo (fixture: Asha Rao), not the identity token.
    expect(await screen.findByText('Namaste, Asha Rao')).toBeInTheDocument();
    expect(await screen.findAllByText('Tuesday, September 29')).not.toHaveLength(0);
    // Banner meta (the header's location button shows the location too).
    expect(screen.getAllByText('Austin, Texas').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Krishna Paksha').length).toBeGreaterThanOrEqual(1);
  });

  it("shows today's Panchang: limbs in force now with end time and what follows, vara, paksha, sunrise, sunset", async () => {
    await atInstant('2026-09-29T18:00:00-05:00');
    storeSelectedLocation();
    renderRoute('/dashboard', { auth: signedIn() });
    await screen.findByRole('region', { name: "Today's Panchang" });
    const panchang = region("Today's Panchang");
    expect(panchang).toHaveTextContent(/Tithi\s*Krishna Chaturthi\s*until 04:25\sAM/);
    expect(panchang).toHaveTextContent('then Krishna Panchami');
    expect(panchang).toHaveTextContent('Bharani');
    // At 18:00 Yoga Harshana (ended 16:50) and Karana Bava (ended 17:34) have given way to Vajra and Balava.
    expect(panchang).toHaveTextContent('Vajra');
    expect(panchang).toHaveTextContent('Balava');
    expect(panchang).toHaveTextContent('then Kaulava');
    expect(panchang).toHaveTextContent('Tuesday');
    expect(panchang).toHaveTextContent('Krishna Paksha');
    expect(panchang).toHaveTextContent(/Sunrise\s*07:23\sAM/);
    expect(panchang).toHaveTextContent(/Sunset\s*07:18\sPM/);
  });

  it('lists auspicious times and times to avoid with what is happening now', async () => {
    await atInstant('2026-09-29T10:00:00-05:00');
    storeSelectedLocation();
    renderRoute('/dashboard', { auth: signedIn() });
    const auspicious = await screen.findByRole('region', { name: 'Auspicious times' });
    expect(auspicious).toHaveTextContent('Amrita Kalam');
    expect(auspicious).toHaveTextContent(/04:36\sPM – 06:06\sPM/);
    // Amrit Kalam overlaps Rahu Kalam (4:19–05:49 PM): a resolved conflict — the overlap is explained inside the entry
    // and the standard "good" message is not shown.
    expect(auspicious).toHaveTextContent(/Overlaps with Rahu Kalam: 04:36\sPM – 05:49\sPM/);
    expect(auspicious).not.toHaveTextContent('Auspicious period for positive activities');

    const avoid = region('Times to avoid');
    const items = within(avoid).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining('Varjyam'),
      expect.stringContaining('Durmuhurtham'),
      expect.stringContaining('Yamagandam'),
      expect.stringContaining('Gulika Kalam'),
      expect.stringContaining('Rahu Kalam'),
      expect.stringContaining('Durmuhurtham'),
    ]);
    expect(items[0]).toHaveTextContent('Over'); // Varjyam 07:34–09:05
    expect(items[1]).toHaveTextContent('Now'); // Durmuhurtham 09:46–10:34
    expect(items[1]).toHaveTextContent('Unfavorable Muhurta'); // glossary guidance
  });

  it('explains the rating with each limb and its reason', async () => {
    await atInstant('2026-09-29T10:00:00-05:00');
    storeSelectedLocation();
    renderRoute('/dashboard', { auth: signedIn() });
    const why = await screen.findByRole('region', { name: 'Why today is Mixed' });
    expect(why).toHaveTextContent('Tithi: Krishna Chaturthi');
    expect(why).toHaveTextContent('Yoga: Harshana');
    expect(why).toHaveTextContent('Favorable');
    expect(why).not.toHaveTextContent('Tithi Krishna Chaturthi: Caution.'); // repeated prefix removed
  });

  it('shows the timeline', async () => {
    await atInstant('2026-09-29T10:00:00-05:00');
    storeSelectedLocation();
    renderRoute('/dashboard', { auth: signedIn() });
    const timeline = await screen.findByRole('region', { name: "Today's timeline" });
    expect(timeline).toHaveTextContent('All times in local time — Austin, Texas');
  });

  it('asks for a location when none is selected', async () => {
    renderRoute('/dashboard', { auth: signedIn() });
    expect(await screen.findByText('Choose a location to see today’s Panchang')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: "Today's Panchang" })).not.toBeInTheDocument();
  });

  it('shows a friendly error with retry when the Panchang cannot be loaded', async () => {
    server.use(scenarios.serverError('/panchang/today'));
    storeSelectedLocation();
    renderRoute('/dashboard', { auth: signedIn() });
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: "Today's Panchang" })).not.toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    await atInstant('2026-09-29T10:00:00-05:00');
    storeSelectedLocation();
    const { container } = renderRoute('/dashboard', { auth: signedIn() });
    await screen.findByRole('region', { name: 'Times to avoid' });
    expect(await axeViolations(container)).toEqual([]);
  });
});
