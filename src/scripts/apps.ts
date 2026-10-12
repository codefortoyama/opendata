import type { OpenDataApp } from '../types';
import { httpsUrl, validateApps } from './data.ts';

const ITEMS_PER_PAGE = 6;

let currentPage = 1;
let filteredApps: OpenDataApp[] = [];
let searchQuery = '';
let allApps: OpenDataApp[] = [];
let qrByUrl: Record<string, string> = {};

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
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

  grid.replaceChildren(...pageApps.map((app) => {
    const card = element('a', 'card card--app');
    card.href = httpsUrl(app.url);
    card.target = '_blank';
    card.rel = 'noopener noreferrer';
    const content = element('div', 'card-content');
    const tags = element('div', 'tags');
    tags.append(...app.category.map(tag => element('span', 'tag', tag)));
    content.append(element('h3', '', app.name), tags, element('p', '', app.description));
    card.append(content);
    const qr = qrByUrl[app.url];
    if (qr && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(qr)) {
      const qrBox = element('div', 'card-qr');
      const image = element('img', '');
      image.src = qr;
      image.alt = `${app.name} のQRコード`;
      image.width = image.height = 96;
      image.loading = 'lazy';
      qrBox.append(image);
      card.append(qrBox);
    }
    const meta = element('div', 'card-meta');
    meta.append(element('span', 'copyright', `© ${app.copyright}`),
      element('span', 'verified-date', `確認日: ${app.verifiedDate}`), element('span', 'arrow', '→'));
    card.append(meta);
    return card;
  }));
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

function getPageFromUrl(): number {
  try {
    const p = parseInt(new URLSearchParams(window.location.search).get('page') ?? '1', 10);
    return Number.isFinite(p) && p >= 1 ? p : 1;
  } catch {
    return 1;
  }
}

function syncPageToUrl(page: number, totalPages: number): void {
  try {
    const url = new URL(window.location.href);
    if (page <= 1) {
      url.searchParams.delete('page');
    } else {
      url.searchParams.set('page', String(Math.min(page, Math.max(totalPages, 1))));
    }
    window.history.pushState({}, '', url);
  } catch {
    // URL同期に失敗してもページネーション自体は継続
  }
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
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has('page')) {
      url.searchParams.delete('page');
      window.history.replaceState({}, '', url);
    }
  } catch {
    // ignore
  }
  renderApps();
  renderPagination();
  updateResultsCount();
}

function init(apps: OpenDataApp[], qrMap: Record<string, string> = {}): void {
  qrByUrl = qrMap;
  allApps = [...validateApps(apps)].sort((a, b) => b.verifiedDate.localeCompare(a.verifiedDate));
  filteredApps = [...allApps];
  currentPage = Math.min(
    getPageFromUrl(),
    Math.max(1, Math.ceil(filteredApps.length / ITEMS_PER_PAGE))
  );

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
      const link = target.closest('.page-btn') as HTMLAnchorElement | null;
      if (!link) return;
      // <a href="?page=N"> のデフォルト遷移(リロード)を止めてSPA的に切替
      e.preventDefault();
      if (link.classList.contains('active')) return;
      const next = parseInt(link.dataset.page ?? '1', 10);
      if (!Number.isFinite(next)) return;
      currentPage = next;
      const totalPages = Math.ceil(filteredApps.length / ITEMS_PER_PAGE);
      syncPageToUrl(currentPage, totalPages);
      renderApps();
      renderPagination();
      grid?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  window.addEventListener('popstate', () => {
    const totalPages = Math.ceil(filteredApps.length / ITEMS_PER_PAGE);
    currentPage = Math.min(getPageFromUrl(), Math.max(1, totalPages));
    renderApps();
    renderPagination();
  });

  renderApps();
  renderPagination();
  updateResultsCount();
}

export { init, ITEMS_PER_PAGE };
export type { OpenDataApp };
