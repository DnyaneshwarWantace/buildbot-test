import { BookmarkCheck, User } from "lucide-react";

const defaultImage ="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop";

export default function ProjectsCard({
  imageUrl = defaultImage,
  name = "Sophie Bennett",
  description = "Product Designer who focuses on simplicity & usability.",
  followers = "312",
  projects = "48",
}: {
  imageUrl?: string;
  name?: string;
  description?: string;
  followers?: string;
  projects?: string;
}) {
  return (
    <article className="w-[340px] overflow-hidden rounded-b-[22px] rounded-t-[5%] border border-[rgba(0,0,0,0.06)] bg-white shadow-[0_4px_24px_rgba(0,0,0,0.08)] cursor-pointer">
      <div className="aspect-video w-full overflow-hidden">
        <img src={imageUrl} alt="" className="h-full w-full object-cover" width={340} height={191} />
      </div>
      <div className="px-5 pb-5 pt-4">
        
        <div className="mb-3 flex items-center">
          <h3 className="text-[17px] font-semibold leading-tight text-[#333333]">{name}</h3>
        </div>
        
        <p className="mb-4 text-[15px] leading-snug text-[#666666]">{description}</p>
        
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-4 text-[15px] text-[#666666]">
            <span className="flex items-center gap-1.5">
              <User className="h-[18px] w-[18px] shrink-0 text-[#666666]" />
              {followers}
            </span>
            <span className="flex items-center gap-1.5">
              <BookmarkCheck className="h-[18px] w-[18px] shrink-0 text-[#666666]" />
              {projects}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}
