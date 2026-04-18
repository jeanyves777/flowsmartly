import { BuildStatusBanner } from "@/components/ecommerce/build-status-banner";

/**
 * Ecommerce section layout.
 *
 * Renders the global build status banner above all /ecommerce/* pages.
 * Whenever a user action triggers a store rebuild (product edit,
 * category update, shipping method change, store settings save),
 * the banner appears to reassure them the store is updating.
 */
export default function EcommerceLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BuildStatusBanner />
      {children}
    </>
  );
}
