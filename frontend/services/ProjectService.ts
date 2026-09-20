/**
 * Project Service
 * Handles project creation, storage, and management with AsyncStorage persistence
 */

import {
  Project,
  ProjectStatus,
  UnityLayoutExportMeta,
} from '../types/project';
import type { ExportResultPayload } from '@/types/unity-bridge';
import { getJson, setJson, removeKey } from '@/utils/storage';

const STORAGE_KEY = 'userProjects';
const MAX_PROJECTS = 100;

class ProjectService {
  private projects: Project[] = [];
  private initialized: boolean = false;

  /**
   * Initialize projects from storage
   */
  private async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const stored = await getJson<Project[]>(STORAGE_KEY, []);
      if (Array.isArray(stored)) {
        this.projects = stored;
      }
    } catch (error) {
      console.warn('[ProjectService] Failed to load projects from storage:', error);
      this.projects = [];
    } finally {
      this.initialized = true;
    }
  }

  /**
   * Persist projects to storage
   */
  private async persist(): Promise<void> {
    try {
      // Keep only the most recent projects to avoid storage bloat
      const projectsToSave = this.projects
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, MAX_PROJECTS);
      await setJson(STORAGE_KEY, projectsToSave);
    } catch (error) {
      console.warn('[ProjectService] Failed to persist projects:', error);
    }
  }

  /**
   * Get all projects
   */
  async getProjects(): Promise<Project[]> {
    await this.initialize();
    return [...this.projects].sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * Get a project by ID
   */
  async getProjectById(id: string): Promise<Project | null> {
    await this.initialize();
    return this.projects.find(p => p.id === id) || null;
  }

  /**
   * Update a project
   */
  async updateProject(id: string, updates: Partial<Project>): Promise<Project | null> {
    await this.initialize();

    const index = this.projects.findIndex(p => p.id === id);
    if (index === -1) {
      throw new Error(`Project with ID ${id} not found`);
    }

    // Validate if name is being updated
    if (updates.name !== undefined) {
      const trimmedName = updates.name.trim();
      if (trimmedName.length === 0) {
        throw new Error('Project name cannot be empty');
      }
      if (trimmedName.length > 50) {
        throw new Error('Project name must be 50 characters or less');
      }
      updates.name = trimmedName;
    }

    this.projects[index] = {
      ...this.projects[index],
      ...updates,
      updatedAt: Date.now(),
    };

    await this.persist();
    return this.projects[index];
  }

  /**
   * Delete a project
   */
  async deleteProject(id: string): Promise<boolean> {
    await this.initialize();

    const index = this.projects.findIndex(p => p.id === id);
    if (index === -1) return false;

    this.projects.splice(index, 1);
    await this.persist();
    return true;
  }

  /**
   * Persist a successful Unity 3D layout export as a project (Profile → Projects).
   */
  async saveUnityLayoutExport(payload: ExportResultPayload): Promise<Project> {
    await this.initialize();

    if (!payload.success || !payload.path) {
      throw new Error(payload.error || 'Unity export failed');
    }

    const exportedAt = Date.now();
    const stamp = new Date(exportedAt).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    const name = payload.fileName?.replace(/\.glb$/i, '') || `Room design ${stamp}`;

    const unityExport: UnityLayoutExportMeta = {
      path: payload.path,
      fileName: payload.fileName || 'room-design.glb',
      byteLength: payload.byteLength || 0,
      furnitureCount: payload.furnitureCount || 0,
      roomMeshCount: payload.roomMeshCount || 0,
      exportedAt,
    };

    const project: Project = {
      id: `unity-export-${exportedAt}-${Math.random().toString(36).substring(2, 9)}`,
      name,
      description: `AR layout export · ${unityExport.furnitureCount} furniture · ${Math.round(unityExport.byteLength / 1024)} KB`,
      roomType: 'Living Room',
      status: 'completed',
      createdAt: exportedAt,
      updatedAt: exportedAt,
      tags: ['unity', 'export', '3d-layout'],
      source: 'unity-export',
      unityExport,
    };

    this.projects.push(project);
    await this.persist();
    console.log('[ProjectService] Saved Unity layout export:', project.id);
    return project;
  }

  /**
   * Clear all projects (for testing/reset)
   */
  async clearAllProjects(): Promise<void> {
    this.projects = [];
    this.initialized = true;
    await removeKey(STORAGE_KEY);
  }

  /**
   * Get project statistics
   */
  async getProjectStats(): Promise<{
    total: number;
    byStatus: Record<ProjectStatus, number>;
    byRoomType: Record<string, number>;
  }> {
    await this.initialize();

    const byStatus: Record<ProjectStatus, number> = {
      draft: 0,
      'in-progress': 0,
      completed: 0,
    };

    const byRoomType: Record<string, number> = {};

    this.projects.forEach(project => {
      byStatus[project.status] = (byStatus[project.status] || 0) + 1;
      byRoomType[project.roomType] = (byRoomType[project.roomType] || 0) + 1;
    });

    return {
      total: this.projects.length,
      byStatus,
      byRoomType,
    };
  }
}

export const projectService = new ProjectService();
