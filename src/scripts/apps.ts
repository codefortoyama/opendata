interface OpenDataApp {
  id: number;
  name: string;
  category: string[];
  description: string;
  url: string;
  copyright: string;
  verifiedDate: string;
}

const ITEMS_PER_PAGE = 6;

let currentPage = 1;
let filteredApps: OpenDataApp[] = [];
let searchQuery = '';
let allApps: OpenDataApp[] = [];

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function getElements() {
  return {
    grid: document.getElementById('apps-grid'),
    pagination: document.getElementById('pagination'),
    searchInput: document.getElementById('search-input'),
    resultsCount: document.querySelector('.search-results-count')
  };
}

function renderApps(): void {
  const { grid } = getElements();
  if (!grid) return;
  const start = (currentPage - 1) * ITEMS_PER_PAGE;
  const end = start + ITEMS_PER_PAGE;
  const pageApps = filteredApps.slice(start, end);

  grid.innerHTML = pageApps.map((app) => `
    <a href="${app.url}" class="card" target="_blank" rel="noopener">
      <div class="card-content">
        <h3>${escapeHtml(app.name)}</h3>
        <div class="tags">
          ${app.category.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
        </div>
        <p>${escapeHtml(app.description)}</p>
      </div>
      <div class="card-qr">
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(app.url)}" alt="QR Code" width="100" height="100" loading="lazy" />
      </div>
      <div class="card-meta">
        <span class="copyright">© ${escapeHtml(app.copyright)}</span>
        <span class="verified-date">確認日: ${escapeHtml(app.verifiedDate)}</span>
        <span class="arrow">→</span>
      </div>
    </a>
  `).join('');
}

function renderPagination(): void {
  const { pagination } = getElements();
  if (!pagination) return;
  const totalPages = Math.ceil(filteredApps.length / ITEMS_PER_PAGE);

  if (totalPages <= 1) {
    pagination.innerHTML = '';
    return;
  }

  let html = '';
  if (currentPage > 1) {
    html += `<a class="page-btn" data-page="${currentPage - 1}" href="?page=${currentPage - 1}" aria-label="前のページ"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg> 前へ</a>`;
  }

  const maxVisiblePages = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

  if (endPage - startPage + 1 < maxVisiblePages) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }

  if (startPage > 1) {
    html += `<a class="page-btn" data-page="1" href="?page=1">1</a>`;
    if (startPage > 2) {
      html += `<span class="page-ellipsis">…</span>`;
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    html += `<a class="page-btn${i === currentPage ? ' active' : ''}" data-page="${i}" href="?page=${i}"${i === currentPage ? ' aria-current="page"' : ''}>${i}</a>`;
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      html += `<span class="page-ellipsis">…</span>`;
    }
    html += `<a class="page-btn" data-page="${totalPages}" href="?page=${totalPages}">${totalPages}</a>`;
  }

  if (currentPage < totalPages) {
    html += `<a class="page-btn" data-page="${currentPage + 1}" href="?page=${currentPage + 1}" aria-label="次のページ">次へ <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg></a>`;
  }

  pagination.innerHTML = html;
}

function updateResultsCount(): void {
  const { resultsCount } = getElements();
  if (!resultsCount) return;
  const total = allApps.length;
  const filtered = filteredApps.length;
  if (searchQuery) {
    resultsCount.textContent = `${filtered} 件ヒット (全 ${total} 件)`;
  } else {
    resultsCount.textContent = `全 ${total} 件`;
  }
}

function filterApps(query: string): void {
  searchQuery = query.trim().toLowerCase();
  if (!searchQuery) {
    filteredApps = [...allApps];
  } else {
    filteredApps = allApps.filter((app) =>
      app.name.toLowerCase().includes(searchQuery) ||
      app.description.toLowerCase().includes(searchQuery) ||
      app.category.some((tag) => tag.toLowerCase().includes(searchQuery)) ||
      app.copyright.toLowerCase().includes(searchQuery)
    );
  }
  currentPage = 1;
  renderApps();
  renderPagination();
  updateResultsCount();
}

function init(apps: OpenDataApp[]): void {
  allApps = apps;
  filteredApps = [...apps];

  const { searchInput, pagination, grid } = getElements();

  if (searchInput) {
    searchInput.addEventListener('input', (e: Event) => {
      const target = e.target as HTMLInputElement;
      filterApps(target.value);
    });
  }

  if (pagination) {
    pagination.addEventListener('click', (e: Event) => {
      const target = e.target as HTMLElement;
      const btn = target.closest('.page-btn') as HTMLButtonElement | null;
      if (btn && !btn.classList.contains('active')) {
        currentPage = parseInt(btn.dataset.page ?? '1', 10);
        renderApps();
        renderPagination();
        grid?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  renderApps();
  renderPagination();
  updateResultsCount();
}

export { init, OpenDataApp, ITEMS_PER_PAGE };