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
  const TABS = [
    { label: "My Projects", value: "my-projects" },
    { label: "Saved", value: "saved" },
    { label: "Templates", value: "templates" },
  ];
  const [activeTab, setActiveTab] = useState(TABS[0].value);

  return (
    <div className="min-h-[200vh]">

      <section className="sticky top-0 flex h-screen w-full items-center justify-center infinite-grid-bg">
        <div className="w-full max-w-2xl px-6">

          <ComposerInput value={composerValue} onChange={setComposerValue} />

        </div>
      </section>

      <section className="relative z-10 min-h-screen  py-12 rounded-[60px] shadow-lg bg-[#F7F4EA]">

        <div className="flex justify-center gap-4">
          {TABS.map((tab) => (
            <button key={tab.value}
              className={`rounded-lg px-4 py-1 bg-[#7EACB5] text-white cursor-pointer ${activeTab === tab.value ? "bg-[#7EACB5] scale-110" : "bg-[#D9D9D9]"}`}
              onClick={() => setActiveTab(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-4 mt-12 mx-[5%]">

          {activeTab === "my-projects" && (
              PROJECTS_DATA.map((project) => (
                <ProjectsCard
                  key={project.id}
                  imageUrl={project.imageUrl}
                  name={project.name}
                  description={project.description}
                  followers={project.followers}
                  projects={project.projects}
                />
              ))
          )}

          {activeTab === "saved" && (
            <div>Saved</div>
          )}

          {activeTab === "templates" && (
            <div>Templates</div>
          )}

        </div>

      </section>

    </div>
  );
}
