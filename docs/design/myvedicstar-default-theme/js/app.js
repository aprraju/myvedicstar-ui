document
  .querySelectorAll('[data-location]')
  .forEach((b) =>
    b.addEventListener('click', () => document.getElementById('locationDrawer')?.classList.toggle('open')),
  );
document
  .querySelectorAll('[data-close]')
  .forEach((b) =>
    b.addEventListener('click', () => document.getElementById('locationDrawer')?.classList.remove('open')),
  );
document.querySelectorAll('.activity').forEach((b) =>
  b.addEventListener('click', () => {
    document.querySelectorAll('.activity').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
  }),
);
