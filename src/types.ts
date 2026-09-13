export interface OpenDataApp {
  id: number;
  name: string;
  category: string[];
  description: string;
  url: string;
  copyright: string;
  verifiedDate: string;
}

export interface PaginationState {
  currentPage: number;
  itemsPerPage: number;
  totalItems: number;
  totalPages: number;
}

export interface SearchState {
  query: string;
  filteredApps: OpenDataApp[];
}