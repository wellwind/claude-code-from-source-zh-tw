// 追蹤目前可見的標題，並在目錄中高亮顯示
const tocLinks = document.querySelectorAll<HTMLAnchorElement>('[data-toc-link]');
const headings: HTMLElement[] = [];

for (const link of tocLinks) {
  const id = link.getAttribute('href')?.slice(1);
  if (id) {
    const heading = document.getElementById(id);
    if (heading) headings.push(heading);
  }
}

if (headings.length > 0) {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          for (const link of tocLinks) {
            const isActive = link.getAttribute('href') === `#${id}`;
            link.classList.toggle('text-terracotta', isActive);
            link.classList.toggle('font-medium', isActive);
            link.classList.toggle('text-muted', !isActive);
          }
        }
      }
    },
    {
      rootMargin: '-80px 0px -60% 0px',
      threshold: 0,
    }
  );

  for (const heading of headings) {
    observer.observe(heading);
  }
}
