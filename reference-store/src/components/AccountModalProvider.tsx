"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";

interface AccountModalContextType {
  isOpen: boolean;
  openAccountModal: () => void;
  closeAccountModal: () => void;
}

const AccountModalContext = createContext<AccountModalContextType>({
  isOpen: false,
  openAccountModal: () => {},
  closeAccountModal: () => {},
});

export function useAccountModal() {
  return useContext(AccountModalContext);
}

export default function AccountModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const openAccountModal = useCallback(() => {
    window.dispatchEvent(new CustomEvent("close-cart"));
    setIsOpen(true);
  }, []);

  const closeAccountModal = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    const handleToggle = () => setIsOpen(prev => {
      if (!prev) window.dispatchEvent(new CustomEvent("close-cart"));
      return !prev;
    });
    const handleOpen = () => openAccountModal();
    const handleClose = () => setIsOpen(false);

    window.addEventListener("toggle-account", handleToggle);
    window.addEventListener("open-account", handleOpen);
    window.addEventListener("close-account", handleClose);
    return () => {
      window.removeEventListener("toggle-account", handleToggle);
      window.removeEventListener("open-account", handleOpen);
      window.removeEventListener("close-account", handleClose);
    };
  }, [openAccountModal]);

  return (
    <AccountModalContext.Provider value={{ isOpen, openAccountModal, closeAccountModal }}>
      {children}
    </AccountModalContext.Provider>
  );
}
