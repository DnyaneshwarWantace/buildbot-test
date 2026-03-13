"use client";

import { useState } from "react";
import ComposerInput from "./(components)/ComposerInput";
import ProjectsCard from "./(components)/ProjectsCard";

const PROJECTS_DATA = [
  {
    id: "1",
    imageUrl: "/example1.png",
    name: "Sophie Bennett",
    description: "Business Intelligence Analyst.",
    followers: "312",
    projects: "48",
  },
  {
    id: "2",
    imageUrl: "/example2.png",
    name: "Alex Chen",
    description: "Peace and Conflict Researcher.",
    followers: "1.2k",
    projects: "24",
  },
  {
    id: "3",
    imageUrl: "/example3.png",
    name: "Jordan Lee",
    description: "On demand designer for startups.",
    followers: "890",
    projects: "16",
  },
];

export default function Home() {
  const [composerValue, setComposerValue] = useState("");

  return (
    <div className="min-h-[200vh]">
      <section className="sticky top-0 flex h-screen w-full items-center justify-center bg-[#F7F4EA]">
        <div className="w-full max-w-2xl px-6">
          <ComposerInput
            value={composerValue}
            onChange={setComposerValue}
          />
        </div>
      </section>

      <section className="relative z-10 min-h-screen bg-white py-12 rounded-[60px] shadow-lg">
        
        <div className="flex justify-center gap-4">
          <button className="rounded-lg px-4 py-1 bg-[#7EACB5] text-white cursor-pointer shadow-lg">My Projects</button>
          <button className="rounded-lg px-4 py-1 bg-[#7EACB5] text-white cursor-pointer">Saved</button>
          <button className="rounded-lg px-4 py-1 bg-[#7EACB5] text-white cursor-pointer">Templates</button>
        </div>
        
        <div className="flex flex-wrap gap-4 mt-12 mx-[5%]">
          {PROJECTS_DATA.map((project) => (
            <ProjectsCard
              key={project.id}
              imageUrl={project.imageUrl}
              name={project.name}
              description={project.description}
              followers={project.followers}
              projects={project.projects}
            />
          ))}
        </div>
      
      </section>
    
    </div>
  );
}
