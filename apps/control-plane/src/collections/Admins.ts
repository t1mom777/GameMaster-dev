import type { CollectionConfig } from 'payload'

export const Admins: CollectionConfig = {
  slug: 'admins',
  admin: {
    defaultColumns: ['name', 'email', 'updatedAt'],
    group: 'People',
    useAsTitle: 'name',
  },
  auth: true,
  fields: [
    {
      name: 'name',
      required: true,
      type: 'text',
    },
    {
      defaultValue: 'owner',
      name: 'role',
      options: [
        {
          label: 'Owner',
          value: 'owner',
        },
        {
          label: 'Operator',
          value: 'operator',
        },
      ],
      required: true,
      type: 'select',
    },
  ],
}
