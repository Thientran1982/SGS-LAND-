import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SocialImage } from '../../components/social-publishing/SocialImage';

describe('SocialImage', () => {
  it('reports failed loads, offers a retry, and reports the next successful load', () => {
    const onError = vi.fn();
    const onLoad = vi.fn();
    render(
      <SocialImage
        src="https://cdn.example/house.jpg"
        alt="Ảnh căn hộ"
        className="h-12 w-12"
        onError={onError}
        onLoad={onLoad}
      />,
    );

    const image = screen.getByRole('img', { name: 'Ảnh căn hộ' });
    fireEvent.error(image);

    expect(onError).toHaveBeenCalledWith('https://cdn.example/house.jpg');
    expect(screen.getByText('Ảnh không khả dụng')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Thử tải lại' })).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Thử tải lại' }));
    const retriedImage = screen.getByRole('img', { name: 'Ảnh căn hộ' });
    fireEvent.load(retriedImage);

    expect(onLoad).toHaveBeenCalledWith('https://cdn.example/house.jpg');
  });
});