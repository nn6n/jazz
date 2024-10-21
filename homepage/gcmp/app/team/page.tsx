import { GlobeIcon, LucideIcon } from "lucide-react";
import Link from "next/link";
import { SiGithub, SiX } from "@icons-pack/react-simple-icons";
import { HeroHeader } from "gcmp-design-system/src/app/components/molecules/HeroHeader";

interface TeamMember {
    name: string;
    titles: string[];
    image: string;
    location: string;
    x?: string;
    github?: string;
    website?: string;
}

const team: Array<TeamMember> = [
    {
        name: "Anselm Eickhoff",
        titles: ["Founder"],
        image: "anselm.jpg",
        location: "Canterbury, UK ",
        x: "anselm_io",
        github: "aeplay",
        website: "https://aeplay.org",
    },
    {
        name: "Andrei Popa",
        titles: ["Full-Stack Dev", "Infra"],
        image: "andrei.jpeg",
        location: "Bucharest, Romania ",
        x: "elitepax",
        github: "pax-k",
    },
    {
        name: "Guido D'Orsi",
        titles: ["Frontend Dev", "React Performance"],
        image: "guido.jpeg",
        location: "Piano di Sorrento, Italy ",
        github: "gdorsi",
    },
    {
        name: "Trisha Lim",
        titles: ["Frontend Dev", "Design", "Marketing"],
        image: "trisha.png",
        location: "Lisbon, Portugal ",
        github: "trishalim",
        website: "https://trishalim.com",
    },
    {
        name: "Benjamin Leveritt",
        titles: ["Full-Stack Dev"],
        image: "benjamin.jpg",
        location: "Portsmouth, UK ",
        github: "bensleveritt",
    },
    {
        name: "Marina Orlova",
        titles: ["Full-Stack Dev"],
        image: "marina.png",
        location: "Tarragona, Spain ",
    },
];

function SocialLink({
    link,
    label,
    icon: Icon,
}: {
    label: string;
    link: string;
    icon: LucideIcon;
}) {
    return (
        <Link href={link} className="p-1 -m-1">
            <Icon size={16} />
            <span className="sr-only">{label}</span>
        </Link>
    );
}

function Person({ person }: { person: TeamMember }) {
    return (
        <div className="flex items-center gap-5">
            <img
                src={`/team/${person.image}`}
                className="size-24 rounded-md shadow-sm"
            />
            <div className="flex flex-col gap-2.5">
                <h3 className="text-lg leading-none font-semibold tracking-tight text-stone-900 dark:text-white">
                    {person.name}
                </h3>
                <p className="text-sm leading-none text-gray-600 dark:text-stone-400">
                    {person.titles.join(", ")}
                </p>
                <p className="text-sm leading-none text-gray-600 dark:text-stone-400">
                    {person.location}
                </p>

                <div className="flex gap-2 mt-0.5">
                    {person.website && (
                        <SocialLink
                            link={person.website}
                            icon={GlobeIcon}
                            label="Website"
                        />
                    )}
                    {person.x && (
                        <SocialLink
                            link={`https://x.com/${person.x}`}
                            icon={SiX}
                            label="X profile"
                        />
                    )}
                    {person.github && (
                        <SocialLink
                            link={`https://github.com/${person.github}`}
                            label="Github profile"
                            icon={SiGithub}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

export default function TeamPage() {
    return (
        <div className="container">
            <HeroHeader title="Meet the team" slogan="" />

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-10">
                {team.map((person) => (
                    <Person key={person.name} person={person} />
                ))}
            </div>
        </div>
    );
}
