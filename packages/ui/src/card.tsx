import * as React from 'react';
import type { HTMLAttributes } from 'react';
import { cn } from './utils';

type DivProps = HTMLAttributes<HTMLDivElement>;
type ParagraphProps = HTMLAttributes<HTMLParagraphElement>;
type HeadingProps = HTMLAttributes<HTMLHeadingElement>;

type ComponentWithRef<T extends HTMLElement, P> = React.ForwardRefExoticComponent<
  P & React.RefAttributes<T>
>;

function CardBase({ className, ...props }: DivProps, ref: React.ForwardedRef<HTMLDivElement>) {
  return (
    <div ref={ref} className={cn('rounded-xl border border-border bg-card text-card-foreground shadow-sm', className)} {...props} />
  );
}

export const Card = React.forwardRef<HTMLDivElement, DivProps>(CardBase) as ComponentWithRef<
  HTMLDivElement,
  DivProps
>;
Card.displayName = 'Card';

function CardHeaderBase({ className, ...props }: DivProps, ref: React.ForwardedRef<HTMLDivElement>) {
  return <div ref={ref} className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />;
}

export const CardHeader = React.forwardRef<HTMLDivElement, DivProps>(CardHeaderBase) as ComponentWithRef<
  HTMLDivElement,
  DivProps
>;
CardHeader.displayName = 'CardHeader';

function CardTitleBase({ className, ...props }: HeadingProps, ref: React.ForwardedRef<HTMLHeadingElement>) {
  return <h3 ref={ref} className={cn('text-2xl font-semibold leading-none tracking-tight', className)} {...props} />;
}

export const CardTitle = React.forwardRef<HTMLHeadingElement, HeadingProps>(CardTitleBase) as ComponentWithRef<
  HTMLHeadingElement,
  HeadingProps
>;
CardTitle.displayName = 'CardTitle';

function CardDescriptionBase(
  { className, ...props }: ParagraphProps,
  ref: React.ForwardedRef<HTMLParagraphElement>
) {
  return <p ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />;
}

export const CardDescription = React.forwardRef<HTMLParagraphElement, ParagraphProps>(
  CardDescriptionBase
) as ComponentWithRef<HTMLParagraphElement, ParagraphProps>;
CardDescription.displayName = 'CardDescription';

function CardContentBase({ className, ...props }: DivProps, ref: React.ForwardedRef<HTMLDivElement>) {
  return <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />;
}

export const CardContent = React.forwardRef<HTMLDivElement, DivProps>(CardContentBase) as ComponentWithRef<
  HTMLDivElement,
  DivProps
>;
CardContent.displayName = 'CardContent';

function CardFooterBase({ className, ...props }: DivProps, ref: React.ForwardedRef<HTMLDivElement>) {
  return <div ref={ref} className={cn('flex items-center p-6 pt-0', className)} {...props} />;
}

export const CardFooter = React.forwardRef<HTMLDivElement, DivProps>(CardFooterBase) as ComponentWithRef<
  HTMLDivElement,
  DivProps
>;
CardFooter.displayName = 'CardFooter';
