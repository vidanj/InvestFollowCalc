import type { ButtonHTMLAttributes } from 'react';
import { Link, type LinkProps } from 'react-router';
import { buttonClass, type ButtonVariant } from './buttonStyles';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant };

export function Button({
  variant = 'primary',
  className = '',
  type = 'button',
  ...props
}: ButtonProps) {
  return <button type={type} className={buttonClass(variant, className)} {...props} />;
}

type ButtonLinkProps = LinkProps & { variant?: ButtonVariant };

export function ButtonLink({ variant = 'primary', className = '', ...props }: ButtonLinkProps) {
  return <Link className={buttonClass(variant, String(className))} {...props} />;
}
