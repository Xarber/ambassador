import { cva } from "class-variance-authority";

const pillVariants = cva(
  "inline-flex items-center rounded-lg px-3 py-1 font-body text-sm text-[color:#fff]",
  {
    variants: {
      tone: {
        red: "bg-primary",
        green: "bg-acceptance",
        black: "bg-foreground",
      },
    },
    defaultVariants: {
      tone: "black",
    },
  },
);

export { pillVariants };
