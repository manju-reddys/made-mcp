import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  title: 'Components/Button',
  component: Button,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs', 'interactive'],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['primary', 'secondary', 'ghost'],
      description: 'Button visual variant'
    },
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
      description: 'Button size'
    },
    disabled: {
      control: { type: 'boolean' },
      description: 'Disabled state'
    }
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Primary button story
export const Primary: Story = {
  args: {
    variant: 'primary',
    children: 'Primary Button',
  },
  render: (args) => \`
    <button class="made-btn made-btn-primary" type="button">
      \${args.children || 'Primary Button'}
    </button>
  \`,
};

// Secondary button story  
export const Secondary: Story = {
  args: {
    variant: 'secondary',
    children: 'Secondary Button',
  },
  render: (args) => \`
    <button class="made-btn made-btn-secondary" type="button">
      \${args.children || 'Secondary Button'}
    </button>
  \`,
};

// Small button story
export const Small: Story = {
  args: {
    variant: 'primary',
    size: 'sm',
    children: 'Small Button',
  },
  render: (args) => \`
    <button class="made-btn made-btn-primary made-btn-sm" type="button">
      \${args.children || 'Small Button'}
    </button>
  \`,
};

// Large button story
export const Large: Story = {
  args: {
    variant: 'primary', 
    size: 'lg',
    children: 'Large Button',
  },
  render: (args) => \`
    <button class="made-btn made-btn-primary made-btn-lg" type="button">
      \${args.children || 'Large Button'}
    </button>
  \`,
};

// Disabled button story
export const Disabled: Story = {
  args: {
    variant: 'primary',
    disabled: true,
    children: 'Disabled Button',
  },
  render: (args) => \`
    <button class="made-btn made-btn-primary" type="button" disabled>
      \${args.children || 'Disabled Button'}
    </button>
  \`,
};