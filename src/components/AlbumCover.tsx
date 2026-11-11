import { useQuery } from "@tanstack/react-query";
import { getCover } from "@/lib/covers.functions";

export function useCover(artist: string, album: string) {
  return useQuery({
    queryKey: ["cover", artist, album],
    queryFn: () => getCover({ data: { artist, album } }),
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

export function AlbumCover({ artist, album, className = "" }: { artist: string; album: string; className?: string }) {
  const { data } = useCover(artist, album);
  if (data?.url)
    return <img src={data.url} alt={`Copertina di ${album}`} loading="lazy" className={`object-cover ${className}`} />;
  return (
    <div className={`flex items-end bg-secondary p-3 ${className}`}>
      <span className="font-display text-sm text-muted-foreground">{album}</span>
    </div>
  );
}
