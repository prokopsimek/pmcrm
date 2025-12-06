'use client';

import type { ContactFilters, ContactSource } from '@/types/contact';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';

/**
 * Hook to manage contact filters and sync with URL query params
 * US-061: Advanced Filtering
 *
 * Features:
 * - Parse filters from URL query params
 * - Update URL when filters change
 * - Shareable filter URLs
 */
export function useContactFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Parse filters from URL query params
  const filters: ContactFilters = useMemo(() => {
    const search = searchParams.get('search') || undefined;
    const tags = searchParams.get('tags')?.split(',').filter(Boolean) || undefined;
    const company = searchParams.get('company') || undefined;
    const position = searchParams.get('position') || undefined;
    const location = searchParams.get('location') || undefined;
    const source = (searchParams.get('source') as ContactSource) || undefined;
    const hasEmail = searchParams.get('hasEmail');
    const hasPhone = searchParams.get('hasPhone');
    const lastContactedFrom = searchParams.get('lastContactedFrom') || undefined;
    const lastContactedTo = searchParams.get('lastContactedTo') || undefined;
    const sortBy = searchParams.get('sortBy') as ContactFilters['sortBy'] || undefined;
    const sortOrder = searchParams.get('sortOrder') as ContactFilters['sortOrder'] || undefined;

    return {
      search,
      tags,
      company,
      position,
      location,
      source,
      hasEmail: hasEmail === 'true' ? true : hasEmail === 'false' ? false : undefined,
      hasPhone: hasPhone === 'true' ? true : hasPhone === 'false' ? false : undefined,
      lastContactedFrom,
      lastContactedTo,
      sortBy,
      sortOrder,
    };
  }, [searchParams]);

  // Update URL with new filters
  const setFilters = useCallback(
    (newFilters: ContactFilters) => {
      const params = new URLSearchParams();

      // Add non-empty filters to URL
      if (newFilters.search) params.set('search', newFilters.search);
      if (newFilters.tags?.length) params.set('tags', newFilters.tags.join(','));
      if (newFilters.company) params.set('company', newFilters.company);
      if (newFilters.position) params.set('position', newFilters.position);
      if (newFilters.location) params.set('location', newFilters.location);
      if (newFilters.source) params.set('source', newFilters.source);
      if (newFilters.hasEmail !== undefined) params.set('hasEmail', String(newFilters.hasEmail));
      if (newFilters.hasPhone !== undefined) params.set('hasPhone', String(newFilters.hasPhone));
      if (newFilters.lastContactedFrom) params.set('lastContactedFrom', newFilters.lastContactedFrom);
      if (newFilters.lastContactedTo) params.set('lastContactedTo', newFilters.lastContactedTo);
      if (newFilters.sortBy) params.set('sortBy', newFilters.sortBy);
      if (newFilters.sortOrder) params.set('sortOrder', newFilters.sortOrder);

      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname);
    },
    [pathname, router]
  );

  // Update a single filter value
  const updateFilter = useCallback(
    <K extends keyof ContactFilters>(key: K, value: ContactFilters[K]) => {
      setFilters({
        ...filters,
        [key]: value,
      });
    },
    [filters, setFilters]
  );

  // Clear all filters
  const clearFilters = useCallback(() => {
    router.push(pathname);
  }, [pathname, router]);

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return !!(
      filters.search ||
      filters.tags?.length ||
      filters.company ||
      filters.position ||
      filters.location ||
      filters.source ||
      filters.hasEmail !== undefined ||
      filters.hasPhone !== undefined ||
      filters.lastContactedFrom ||
      filters.lastContactedTo
    );
  }, [filters]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.search) count++;
    if (filters.tags?.length) count++;
    if (filters.company) count++;
    if (filters.position) count++;
    if (filters.location) count++;
    if (filters.source) count++;
    if (filters.hasEmail !== undefined) count++;
    if (filters.hasPhone !== undefined) count++;
    if (filters.lastContactedFrom || filters.lastContactedTo) count++;
    return count;
  }, [filters]);

  return {
    filters,
    setFilters,
    updateFilter,
    clearFilters,
    hasActiveFilters,
    activeFilterCount,
  };
}




