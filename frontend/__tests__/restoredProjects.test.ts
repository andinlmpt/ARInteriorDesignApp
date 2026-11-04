import { describe, it, expect } from '@jest/globals';
import { missingProjects, projectFromServer, type ServerDesignProject } from '@/utils/restoredProjects';
import type { Project } from '@/types/project';

const remote = (projectId: string, extra: Partial<ServerDesignProject> = {}): ServerDesignProject => ({
  projectId,
  finalized: true,
  title: 'Minimalist Bedroom Design — Option A',
  roomType: 'Bedroom',
  style: 'Minimalist',
  createdAt: 100,
  updatedAt: 200,
  ...extra,
});

describe('restored projects', () => {
  it('makes a design project the Projects screen shows and can open', () => {
    expect(projectFromServer(remote('project-1'))).toMatchObject({
      id: 'project-1',
      name: 'Minimalist Bedroom Design — Option A',
      arMode: 'design',
      status: 'completed',
      roomType: 'Bedroom',
      createdAt: 100,
      updatedAt: 200,
    });
  });

  it('names an unsaved design from its room and style, and keeps it in progress', () => {
    const project = projectFromServer(remote('project-2', { finalized: false, title: '' }));
    expect(project.name).toBe('Minimalist Bedroom design');
    expect(project.status).toBe('in-progress');
  });

  it('keeps names within the project name limit', () => {
    expect(projectFromServer(remote('project-3', { title: 'x'.repeat(80) })).name).toHaveLength(50);
  });

  it('adds only what the phone is missing, leaving its own projects alone', () => {
    const local = [{ id: 'project-1', name: 'My room' }] as Project[];
    const added = missingProjects(local, [remote('project-1'), remote('project-2')]);
    expect(added.map((project) => project.id)).toEqual(['project-2']);
  });
});
