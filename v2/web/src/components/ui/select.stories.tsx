import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, userEvent, waitFor, within } from 'storybook/test'

import { Select, SelectItem } from './select'

function Surface({ count = 24, position = 'middle' }) {
  const [value, setValue] = useState<string | null>('option-0')
  return (
    <div
      className='fixed inset-0 flex flex-col px-6 py-8'
      style={{
        justifyContent: position === 'top'
          ? 'flex-start'
          : position === 'bottom'
          ? 'flex-end'
          : 'center',
      }}
    >
      <div className='w-64 max-w-full'>
        <Select
          placeholder='选择模型'
          value={value}
          onValueChange={setValue}
          renderValue={(selected) =>
            `模型 ${Number(selected.split('-')[1]) + 1}`}
        >
          {Array.from(
            { length: count },
            (_, index) => (
              <SelectItem key={index} value={`option-${index}`}>
                模型 {index + 1}
              </SelectItem>
            ),
          )}
        </Select>
      </div>
    </div>
  )
}

const meta = {
  title: 'Components/Select',
  component: Surface,
} satisfies Meta<typeof Surface>

export default meta
type Story = StoryObj<typeof meta>

export const StableScrolling: Story = {
  name: '长列表滚动时高度不变',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)
    const trigger = canvas.getByRole('combobox', { name: '选择模型' })
    await userEvent.click(trigger)
    const list = await body.findByRole('listbox')
    await waitFor(() => expect(list.clientHeight).toBeGreaterThan(0))
    const before = list.getBoundingClientRect()
    await expect(list.scrollHeight).toBeGreaterThan(list.clientHeight)
    list.scrollTop += 120
    list.dispatchEvent(new Event('scroll'))
    await waitFor(() => expect(list.scrollTop).toBeGreaterThan(0))
    await expect(list.getBoundingClientRect().height).toBeCloseTo(
      before.height,
      0,
    )
    await expect(list.getBoundingClientRect().top).toBeCloseTo(before.top, 0)
    // Opening the popup schedules focus separately from layout. Wait for keyboard
    // ownership just as the reopen assertion below does, before sending keys.
    await waitFor(() =>
      expect(list.contains(canvasElement.ownerDocument.activeElement)).toBe(
        true,
      )
    )
    // Keyboard navigation must still reach an offscreen option and restore focus.
    await userEvent.keyboard('{End}{Enter}')
    await expect(trigger).toHaveTextContent('模型 24')
    await waitFor(() => expect(trigger).toHaveFocus())
    await userEvent.click(trigger)
    const reopened = await body.findByRole('listbox')
    await waitFor(() =>
      expect(reopened.contains(canvasElement.ownerDocument.activeElement)).toBe(
        true,
      )
    )
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(trigger).toHaveFocus())
  },
}

export const NearTop: Story = {
  args: { position: 'top' },
  play: StableScrolling.play,
}
export const NearBottom: Story = {
  args: { position: 'bottom' },
  play: StableScrolling.play,
}
export const ShortList: Story = {
  args: { count: 3 },
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('combobox')
    await userEvent.click(trigger)
    const body = within(canvasElement.ownerDocument.body)
    const list = await body.findByRole('listbox')
    await expect(list.scrollHeight).toBe(list.clientHeight)
    await userEvent.click(body.getByRole('option', { name: '模型 3' }))
    await expect(trigger).toHaveTextContent('模型 3')
    await waitFor(() => expect(trigger).toHaveFocus())
  },
}
