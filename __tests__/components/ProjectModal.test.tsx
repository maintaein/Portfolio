import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProjectModal from '@/components/blocks/ProjectModal';
import type { Project } from '@/types';

const project: Project = {
  title: 'Accessible Project',
  image: '/projects/test.webp',
  tags: [],
};

describe('ProjectModal accessibility', () => {
  it('gives the dialog an accessible name through its existing title', async () => {
    render(<ProjectModal isOpen onClose={vi.fn()} project={project} />);

    const dialog = await screen.findByRole('dialog', { name: project.title });
    expect(dialog).toHaveAccessibleName(project.title);
    expect(dialog).toHaveAttribute('aria-labelledby', 'modal-title');
  });
});
