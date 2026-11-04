/**
 * The Projects list lives on the phone, so reinstalling the app or changing phones emptied it while
 * the designs were still on the server (2026-11-04). These turn the server's list into the projects
 * this phone is missing. The server doesn't keep the name typed for a project, so it uses the design's.
 */

import type { DesignStyle, Project, RoomType } from '@/types/project';

/** One entry of GET /designs/projects. */
export interface ServerDesignProject {
  projectId: string;
  finalized: boolean;
  title: string;
  roomType: string;
  style: string;
  createdAt: number;
  updatedAt: number;
}

const MAX_NAME_LENGTH = 50;

export function projectFromServer(remote: ServerDesignProject): Project {
  const name = remote.title.trim() || `${remote.style} ${remote.roomType} design`.trim();
  return {
    id: remote.projectId,
    name: name.slice(0, MAX_NAME_LENGTH),
    description: 'AI room design project',
    roomType: remote.roomType as RoomType,
    style: (remote.style || undefined) as DesignStyle | undefined,
    status: remote.finalized ? 'completed' : 'in-progress',
    createdAt: remote.createdAt,
    updatedAt: remote.updatedAt,
    source: 'manual',
    arMode: 'design',
  };
}

/** The server's projects this phone doesn't have yet. */
export function missingProjects(local: Project[], remote: ServerDesignProject[]): Project[] {
  const known = new Set(local.map((project) => project.id));
  return remote.filter((entry) => !known.has(entry.projectId)).map(projectFromServer);
}
