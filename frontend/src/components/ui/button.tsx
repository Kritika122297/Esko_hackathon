import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap rounded font-semibold transition-[background-color,border-color,color,transform,box-shadow] duration-150 ease-out active:translate-y-px disabled:pointer-events-none disabled:opacity-55",
  {
    variants: {
      variant: {
        default: "bg-rail text-white hover:bg-rail-2 shadow-[inset_0_-1px_0_rgba(0,0,0,0.25)]",
        outline: "border border-line-strong bg-stock text-ink hover:border-ink hover:bg-ground",
        ghost: "text-ink-2 hover:bg-ink/5",
        destructive: "bg-stop text-white hover:bg-stop-deep",
        onRail: "border border-white/30 bg-white/10 text-white hover:bg-white/20",
        talker: "bg-talker text-ink hover:brightness-95",
        link: "text-rail underline decoration-1 hover:decoration-2",
      },
      size: {
        default: "h-9 px-4 text-[13px]",
        sm: "h-7 px-2.5 text-xs",
        lg: "h-11 px-6 text-sm",
        icon: "h-8 w-8",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
