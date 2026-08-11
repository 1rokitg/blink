"use client";

import * as React from "react";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

type RootCredenzaProps = {
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

type CredenzaProps = {
  className?: string;
  children?: React.ReactNode;
  asChild?: true;
};

/** Bridge duplicate @types/react copies in the monorepo hoisted deps. */
function slot(node: React.ReactNode): any {
  return node;
}

const CredenzaContext = React.createContext<{ isMobile: boolean }>({
  isMobile: false,
});

function useCredenzaContext() {
  return React.useContext(CredenzaContext);
}

function Credenza({ children, ...props }: RootCredenzaProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <CredenzaContext.Provider value={{ isMobile: true }}>
        <Drawer autoFocus {...props}>
          {slot(children)}
        </Drawer>
      </CredenzaContext.Provider>
    );
  }

  return (
    <CredenzaContext.Provider value={{ isMobile: false }}>
      <Dialog {...props}>{slot(children)}</Dialog>
    </CredenzaContext.Provider>
  );
}

function CredenzaTrigger({ className, children, ...props }: CredenzaProps) {
  const { isMobile } = useCredenzaContext();
  if (isMobile) {
    return (
      <DrawerTrigger className={className} {...props}>
        {slot(children)}
      </DrawerTrigger>
    );
  }
  return (
    <DialogTrigger className={className} {...props}>
      {slot(children)}
    </DialogTrigger>
  );
}

function CredenzaClose({ className, children, ...props }: CredenzaProps) {
  const { isMobile } = useCredenzaContext();
  if (isMobile) {
    return (
      <DrawerClose className={className} {...props}>
        {slot(children)}
      </DrawerClose>
    );
  }
  return (
    <DialogClose className={className} {...props}>
      {slot(children)}
    </DialogClose>
  );
}

function CredenzaContent({ className, children, ...props }: CredenzaProps) {
  const { isMobile } = useCredenzaContext();
  if (isMobile) {
    return (
      <DrawerContent className={className} {...props}>
        {slot(children)}
      </DrawerContent>
    );
  }
  return (
    <DialogContent className={className} {...props}>
      {slot(children)}
    </DialogContent>
  );
}

function CredenzaDescription({
  className,
  children,
  ...props
}: CredenzaProps) {
  const { isMobile } = useCredenzaContext();
  if (isMobile) {
    return (
      <DrawerDescription className={className} {...props}>
        {slot(children)}
      </DrawerDescription>
    );
  }
  return (
    <DialogDescription className={className} {...props}>
      {slot(children)}
    </DialogDescription>
  );
}

function CredenzaHeader({ className, children, ...props }: CredenzaProps) {
  const { isMobile } = useCredenzaContext();
  if (isMobile) {
    return (
      <DrawerHeader className={className} {...props}>
        {slot(children)}
      </DrawerHeader>
    );
  }
  return (
    <DialogHeader className={className} {...props}>
      {slot(children)}
    </DialogHeader>
  );
}

function CredenzaTitle({ className, children, ...props }: CredenzaProps) {
  const { isMobile } = useCredenzaContext();
  if (isMobile) {
    return (
      <DrawerTitle className={className} {...props}>
        {slot(children)}
      </DrawerTitle>
    );
  }
  return (
    <DialogTitle className={className} {...props}>
      {slot(children)}
    </DialogTitle>
  );
}

function CredenzaBody({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("px-4 md:px-0", className)} {...props}>
      {children}
    </div>
  );
}

function CredenzaFooter({ className, children, ...props }: CredenzaProps) {
  const { isMobile } = useCredenzaContext();
  if (isMobile) {
    return (
      <DrawerFooter className={className} {...props}>
        {slot(children)}
      </DrawerFooter>
    );
  }
  return (
    <DialogFooter className={className} {...props}>
      {slot(children)}
    </DialogFooter>
  );
}

export {
  Credenza,
  CredenzaTrigger,
  CredenzaClose,
  CredenzaContent,
  CredenzaDescription,
  CredenzaHeader,
  CredenzaTitle,
  CredenzaBody,
  CredenzaFooter,
};
