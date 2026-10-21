import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-semibold transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 motion-reduce:active:scale-100",
  {
    variants: {
      variant: {
        default: "bg-ink text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_1px_2px_rgba(21,24,43,0.2)] hover:bg-ink-2",
        outline: "border border-line-strong bg-paper text-ink hover:border-ink hover:bg-desk/60",
        soft: "bg-desk text-ink hover:bg-desk-2",
        ghost: "text-ink-2 hover:bg-ink/[0.06] hover:text-ink",
        destructive: "bg-stop text-white hover:bg-stop-deep",
        onInk: "border border-white/25 bg-white/10 text-white hover:bg-white/20",
        canary: "bg-canary text-ink shadow-[inset_0_-1px_0_rgba(115,86,0,0.25)] hover:bg-[#FFD633]",
        link: "h-auto px-0 text-ink underline decoration-ink/30 decoration-1 hover:decoration-ink active:scale-100",
      },
      size: {
        default: "h-9 px-3.5 text-[13.5px]",
        sm: "h-8 px-2.5 text-[12.5px]",
        lg: "h-11 px-5 text-[14.5px]",
        xl: "h-12 rounded-lg px-6 text-[15px]",
        icon: "h-9 w-9",
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
