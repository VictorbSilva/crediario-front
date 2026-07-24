type BrandMarkProps = {
  className?: string
}

/**
 * Marca da loja: silhueta de casa com um "H" formado pelas paredes internas.
 * Desenhada em código (stroke = currentColor) para não depender de assets.
 */
export function BrandMark({ className }: BrandMarkProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={5}
      strokeLinecap="square"
      role="img"
      aria-label="Crediário"
    >
      <path d="M10 32 32 12l22 20" />
      <path d="M44 22V15h6v13" />
      <path d="M15 31v23M49 31v23" />
      <path d="M25 37v17M39 37v17M25 44h14" />
    </svg>
  )
}
