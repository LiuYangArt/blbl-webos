import { createContext, type ReactNode, useContext, useEffect } from 'react';

type RegisterBackHandler = (handler: (() => boolean) | null) => void;

const PageBackHandlerContext = createContext<RegisterBackHandler | null>(null);

export function PageBackHandlerProvider({
  children,
  onRegister,
}: {
  children: ReactNode;
  onRegister: RegisterBackHandler;
}) {
  return (
    <PageBackHandlerContext.Provider value={onRegister}>
      {children}
    </PageBackHandlerContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePageBackHandler(handler: (() => boolean) | null) {
  const register = useContext(PageBackHandlerContext);

  useEffect(() => {
    if (!register) {
      return;
    }
    register(handler);
    return () => {
      register(null);
    };
  }, [handler, register]);
}
