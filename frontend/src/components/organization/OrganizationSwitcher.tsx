'use client';

import { useState } from 'react';
import { Check, ChevronsUpDown, Plus, Building2 } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useOrganizations, useActiveOrganization } from '@/hooks/use-organization';

/**
 * Organization Switcher Component
 * Dropdown to switch between organizations the user belongs to
 */
export function OrganizationSwitcher() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { organizations, isLoading: isLoadingOrgs } = useOrganizations();
  const { activeOrganization, setActiveOrganization, isLoading: isLoadingActive } = useActiveOrganization();

  const isLoading = isLoadingOrgs || isLoadingActive;

  const handleSelect = async (orgId: string, orgSlug: string) => {
    if (orgId === activeOrganization?.id) {
      setOpen(false);
      return;
    }
    await setActiveOrganization(orgId);
    setOpen(false);

    // Redirect to the same page in the new organization
    // Extract current path without org slug and apply new org slug
    const pathParts = pathname.split('/').filter(Boolean);

    // Check if current path has an org slug (first part is org slug)
    const currentOrgSlug = activeOrganization?.slug;
    let currentPath = '/dashboard'; // Default path

    if (currentOrgSlug && pathParts[0] === currentOrgSlug) {
      // Remove current org slug and use rest of path
      currentPath = '/' + pathParts.slice(1).join('/') || '/dashboard';
    } else if (pathParts.length > 0 && organizations.some(o => o.slug === pathParts[0])) {
      // First part is an org slug, get path without it
      currentPath = '/' + pathParts.slice(1).join('/') || '/dashboard';
    }

    // Navigate to new org with same path
    router.push(`/${orgSlug}${currentPath}`);
  };

  const handleCreateNew = () => {
    setOpen(false);
    router.push('/organizations/new');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (isLoading) {
    return (
      <Button variant="outline" className="w-[200px] justify-between" disabled>
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded bg-muted animate-pulse" />
          <span className="text-muted-foreground">Loading...</span>
        </div>
      </Button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Select organization"
          className="w-[200px] justify-between"
        >
          {activeOrganization ? (
            <div className="flex items-center gap-2 truncate">
              <Avatar className="h-5 w-5">
                <AvatarImage src={activeOrganization.logo || undefined} />
                <AvatarFallback className="text-xs">
                  {getInitials(activeOrganization.name)}
                </AvatarFallback>
              </Avatar>
              <span className="truncate">{activeOrganization.name}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Building2 className="h-4 w-4" />
              <span>Select organization</span>
            </div>
          )}
          <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput placeholder="Search organizations..." />
          <CommandList>
            <CommandEmpty>No organization found.</CommandEmpty>
            <CommandGroup heading="Organizations">
              {organizations.map((org) => (
                <CommandItem
                  key={org.id}
                  value={org.name}
                  onSelect={() => handleSelect(org.id, org.slug)}
                  className="cursor-pointer"
                >
                  <Avatar className="mr-2 h-5 w-5">
                    <AvatarImage src={org.logo || undefined} />
                    <AvatarFallback className="text-xs">
                      {getInitials(org.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate">{org.name}</span>
                  <Check
                    className={cn(
                      'ml-auto h-4 w-4',
                      activeOrganization?.id === org.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              <CommandItem onSelect={handleCreateNew} className="cursor-pointer">
                <Plus className="mr-2 h-4 w-4" />
                Create Organization
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

