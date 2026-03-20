interface Props {
  rating: number;   // 0–5
  count?: number;
  size?: "sm" | "md";
}

export default function StarRating({ rating, count, size = "sm" }: Props) {
  const stars = Array.from({ length: 5 }, (_, i) => {
    const filled = rating >= i + 1;
    const half = !filled && rating >= i + 0.5;
    return { filled, half };
  });

  return (
    <span className={`flex items-center gap-1 ${size === "sm" ? "text-xs" : "text-sm"}`}>
      <span className="flex">
        {stars.map((s, i) => (
          <span
            key={i}
            className={
              s.filled
                ? "text-amber-400"
                : s.half
                ? "text-amber-300"
                : "text-stone-300"
            }
          >
            ★
          </span>
        ))}
      </span>
      {count !== undefined && (
        <span className="text-stone-400">
          {rating.toFixed(1)} ({count.toLocaleString()})
        </span>
      )}
    </span>
  );
}
