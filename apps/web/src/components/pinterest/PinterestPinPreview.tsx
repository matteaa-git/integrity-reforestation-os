"use client";

interface Props {
  title: string;
  description: string;
  destinationUrl: string;
  boardName: string;
  pinType: string;
  coverImageUrl: string;
  tags: string[];
  score: number;
  estimatedMonthlyViews: number;
}

function FormattedDesc({ text }: { text: string }) {
  if (!text) return <span className="text-gray-400 italic text-[12px]">Your description will appear here…</span>;
  return (
    <span>
      {text.split(/(\s+)/).map((word, i) =>
        word.startsWith("#") ? (
          <span key={i} className="text-[#E60023] font-medium">{word}</span>
        ) : (
          <span key={i}>{word}</span>
        )
      )}
    </span>
  );
}

export default function PinterestPinPreview({
  title,
  description,
  destinationUrl,
  boardName,
  pinType,
  coverImageUrl,
  tags,
  score,
  estimatedMonthlyViews,
}: Props) {
  const domain = (() => {
    try { return new URL(destinationUrl).hostname.replace("www.", ""); }
    catch { return destinationUrl || null; }
  })();

  const scoreColor =
    score >= 75 ? "text-emerald-600 bg-emerald-50" :
    score >= 50 ? "text-amber-600 bg-amber-50" :
    "text-gray-500 bg-gray-100";

  return (
    <div className="space-y-3">
      {/* Pinterest pin card */}
      <div className="rounded-2xl overflow-hidden shadow-md bg-white max-w-[236px] mx-auto">
        {/* Cover image area */}
        <div className="relative bg-gray-100" style={{ aspectRatio: "2/3" }}>
          {coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverImageUrl}
              alt={title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-gray-300">
              <div className="text-4xl">📌</div>
              <div className="text-[10px]">Add cover image URL</div>
            </div>
          )}

          {/* Pin type badge */}
          {pinType !== "standard" && (
            <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/60 text-white text-[9px] font-semibold uppercase tracking-wide">
              {pinType === "idea" ? "Idea Pin" : pinType === "video" ? "Video" : "Product"}
            </div>
          )}

          {/* Save button overlay */}
          <div className="absolute top-2 right-2">
            <div className="px-3 py-1.5 rounded-full bg-[#E60023] text-white text-[11px] font-bold shadow">
              Save
            </div>
          </div>
        </div>

        {/* Card content */}
        <div className="px-3 pt-2.5 pb-3">
          {title && (
            <div className="text-[13px] font-bold text-gray-900 leading-snug mb-1 line-clamp-2">
              {title}
            </div>
          )}
          {description && (
            <div className="text-[11px] text-gray-600 leading-snug line-clamp-3 mb-2">
              <FormattedDesc text={description} />
            </div>
          )}
          {domain && (
            <div className="flex items-center gap-1 text-[10px] text-gray-400">
              <div className="w-3 h-3 rounded-full bg-gray-200 flex items-center justify-center text-[7px]">🌐</div>
              {domain}
            </div>
          )}
        </div>
      </div>

      {/* Board pill */}
      {boardName && (
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-gray-600 font-medium">
          <span className="text-gray-400">→</span>
          <span className="bg-gray-100 px-3 py-1 rounded-full">{boardName}</span>
        </div>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 justify-center">
          {tags.slice(0, 6).map((tag) => (
            <span key={tag} className="text-[10px] text-[#E60023]/80 bg-[#E60023]/8 px-2 py-0.5 rounded-full">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Score + reach */}
      <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">Pin Score</span>
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${scoreColor}`}>{score}</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              score >= 75 ? "bg-emerald-500" : score >= 50 ? "bg-amber-400" : "bg-gray-300"
            }`}
            style={{ width: `${score}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[10px] text-gray-400">
          <span>Est. monthly views</span>
          <span className="font-semibold text-gray-600">
            {estimatedMonthlyViews >= 1000
              ? `${(estimatedMonthlyViews / 1000).toFixed(1)}K`
              : estimatedMonthlyViews}
          </span>
        </div>
      </div>
    </div>
  );
}
