interface TruMarketLogoProps {
  className?: string;
}

export function TruMarketLogo({ className = "h-8" }: TruMarketLogoProps) {
  return (
    <img
      src="/logo.svg"
      alt="TruMarket"
      className={className}
      width={120}
      height={47}
    />
  );
}
