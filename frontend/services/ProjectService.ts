/**
 * Project Service
 * Handles project creation, storage, and management with AsyncStorage persistence
 */

import { Project, CreateProjectInput, ProjectStatus } from '../types/project';
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
   * Validate project input
   */
  private validateInput(input: CreateProjectInput): { valid: boolean; error?: string } {
    if (!input.name || input.name.trim().length === 0) {
      return { valid: false, error: 'Project name is required' };
    }

    if (input.name.length > 50) {
      return { valid: false, error: 'Project name must be 50 characters or less' };
    }

    if (input.description && input.description.length > 200) {
      return { valid: false, error: 'Description must be 200 characters or less' };
    }

    if (input.dimensions) {
      const { width, length, height } = input.dimensions;
      if (width <= 0 || length <= 0 || height <= 0) {
        return { valid: false, error: 'Dimensions must be positive numbers' };
      }
      if (width > 50 || length > 50 || height > 10) {
        return { valid: false, error: 'Dimensions are unreasonably large' };
      }
    }

    return { valid: true };
  }

  /**
   * Create a new project
   */
  async createProject(input: CreateProjectInput): Promise<Project> {
    await this.initialize();

    // Validate input
    const validation = this.validateInput(input);
    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid project input');
    }

    const project: Project = {
      id: `project-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      name: input.name.trim(),
      description: input.description?.trim(),
      roomType: input.roomType,
      style: input.style,
      dimensions: input.dimensions,
      budget: input.budget,
      status: 'draft',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tags: input.style ? [input.style.toLowerCase()] : [],
      thumbnail: undefined,
    };

    this.projects.push(project);
    await this.persist();

    console.log('✅ Project created:', project.id);
    return project;
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
   * Update project status
   */
  async updateProjectStatus(id: string, status: ProjectStatus): Promise<Project | null> {
    return this.updateProject(id, { status });
  }

  /**
   * Get projects by status
   */
  async getProjectsByStatus(status: ProjectStatus): Promise<Project[]> {
    await this.initialize();
    return this.projects.filter(p => p.status === status);
  }

  /**
   * Get recent projects
   */
  async getRecentProjects(limit: number = 5): Promise<Project[]> {
    await this.initialize();
    return [...this.projects]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, Math.max(1, Math.min(limit, 50)));
  }

  /**
   * Search projects by name or tags
   */
  async searchProjects(query: string): Promise<Project[]> {
    await this.initialize();
    const lowerQuery = query.toLowerCase().trim();

    if (!lowerQuery) return [];

    return this.projects.filter(project => {
      const nameMatch = project.name.toLowerCase().includes(lowerQuery);
      const descMatch = project.description?.toLowerCase().includes(lowerQuery);
      const tagMatch = project.tags?.some(tag => tag.toLowerCase().includes(lowerQuery));
      const roomMatch = project.roomType.toLowerCase().includes(lowerQuery);

      return nameMatch || descMatch || tagMatch || roomMatch;
    }).sort((a, b) => b.updatedAt - a.updatedAt);
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
