"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { isAdminTestCompany } from "@/lib/company";

type CompanyRef = {
  id?: string | null;
  name?: string | null;
  login_id?: string | null;
};

type Ctx = {
  showTest: boolean;
  setShowTest: (next: boolean) => void;
  hiddenCompanyIds: string[];
  includeCompany: (company: CompanyRef | null | undefined) => boolean;
};

const AdminTestVisibilityContext = createContext<Ctx | null>(null);

export function AdminTestVisibilityProvider({
  companies,
  children,
}: {
  companies: (CompanyRef & { id: string })[];
  children: ReactNode;
}) {
  const [showTest, setShowTest] = useState(false);
  const hiddenCompanyIds = useMemo(
    () => companies.filter((c) => isAdminTestCompany(c)).map((c) => c.id),
    [companies],
  );
  const hiddenSet = useMemo(() => new Set(hiddenCompanyIds), [hiddenCompanyIds]);
  const includeCompany = useCallback(
    (company: CompanyRef | null | undefined) => {
      if (showTest || !company) return true;
      if (company.id && hiddenSet.has(company.id)) return false;
      return !isAdminTestCompany(company);
    },
    [showTest, hiddenSet],
  );
  const value = useMemo(
    () => ({ showTest, setShowTest, hiddenCompanyIds, includeCompany }),
    [showTest, hiddenCompanyIds, includeCompany],
  );
  return (
    <AdminTestVisibilityContext.Provider value={value}>
      {children}
    </AdminTestVisibilityContext.Provider>
  );
}

export function useAdminTestVisibility() {
  const ctx = useContext(AdminTestVisibilityContext);
  if (ctx) return ctx;
  return {
    showTest: false,
    setShowTest: () => {},
    hiddenCompanyIds: [] as string[],
    includeCompany: (company: CompanyRef | null | undefined) =>
      !company || !isAdminTestCompany(company),
  };
}
