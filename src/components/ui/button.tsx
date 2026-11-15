import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/** Bouton style shadcn/ui, adapté aux thèmes (zone tactile ≥ 44px, effet d'enfoncement). */
const buttonVariants = cva(
  "btn-press inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-control text-sm font-medium select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-accent text-on-accent border-[length:var(--border-width)] border-border px-4",
        secondary: "bg-surface-2 text-text border-[length:var(--border-width)] border-border px-4",
        ghost: "text-text-2 hover:text-text hover:bg-surface-2 px-3 [[data-theme=brutal]_&]:shadow-none [[data-theme=dessine]_&]:shadow-none",
      },
      size: {
        md: "h-11",
        icon: "size-11 px-0",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
