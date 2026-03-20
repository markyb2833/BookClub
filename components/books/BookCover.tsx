import Image from "next/image";

interface Props {
  coverUrl?: string | null;
  title: string;
  size?: "sm" | "md" | "lg";
}

const sizes = {
  sm: { width: 60, height: 90, className: "w-[60px] h-[90px]" },
  md: { width: 100, height: 150, className: "w-[100px] h-[150px]" },
  lg: { width: 160, height: 240, className: "w-[160px] h-[240px]" },
};

export default function BookCover({ coverUrl, title, size = "md" }: Props) {
  const { width, height, className } = sizes[size];

  if (!coverUrl) {
    return (
      <div
        className={`${className} rounded bg-stone-200 flex items-center justify-center shrink-0`}
      >
        <span className="text-stone-400 text-xs text-center px-1 leading-tight">
          {title.slice(0, 30)}
        </span>
      </div>
    );
  }

  return (
    <div className={`${className} relative rounded overflow-hidden shrink-0 shadow-sm`}>
      <Image
        src={coverUrl}
        alt={title}
        fill
        className="object-cover"
        sizes={`${width}px`}
      />
    </div>
  );
}
