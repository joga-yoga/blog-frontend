import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArticleGeneratorForm } from '@/components/articles/ArticleGeneratorForm';
import { ApiError, createArticle, ServiceUnavailableError } from '@/lib/api/client';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn()
}));

jest.mock('@/lib/api/client', () => {
  const actual = jest.requireActual('@/lib/api/client');
  return {
    ...actual,
    createArticle: jest.fn()
  };
});

const mockedUseRouter = useRouter as jest.Mock;
const mockedUseSearchParams = useSearchParams as jest.Mock;
const mockedCreateArticle = createArticle as jest.MockedFunction<typeof createArticle>;

describe('ArticleGeneratorForm', () => {
  beforeEach(() => {
    mockedCreateArticle.mockReset();
    mockedUseRouter.mockReturnValue({ push: jest.fn() });
    mockedUseSearchParams.mockReturnValue({ get: () => null });
  });

  it('validates minimal topic length', async () => {
    render(<ArticleGeneratorForm rubrics={[]} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Temat artykułu'), 'abc');
    await user.click(screen.getByRole('button', { name: /Wygeneruj artykuł/i }));

    expect(screen.getByText('Popraw zaznaczone pola i spróbuj ponownie.')).toBeInTheDocument();
    expect(mockedCreateArticle).not.toHaveBeenCalled();
  });

  it('submits data and redirects on success', async () => {
    const push = jest.fn();
    mockedUseRouter.mockReturnValue({ push });
    mockedCreateArticle.mockResolvedValue({ status: 'published', slug: 'nowy-artykul', id: 1 });

    render(
      <ArticleGeneratorForm
        rubrics={[
          { code: 'biz', name_pl: 'Biznes', is_active: true }
        ]}
      />
    );

    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Temat artykułu'), 'Nowy artykuł o innowacjach');
    await user.selectOptions(screen.getByLabelText('Rubryka'), 'biz');
    await user.type(screen.getByLabelText('Słowa kluczowe'), 'innowacje, gospodarka');
    await user.type(screen.getByLabelText('Dodatkowe wskazówki'), 'Uwzględnij aktualne dane statystyczne.');
    await user.click(screen.getByRole('button', { name: /Wygeneruj artykuł/i }));

    expect(mockedCreateArticle).toHaveBeenCalledWith({
      topic: 'Nowy artykuł o innowacjach',
      rubric_code: 'biz',
      keywords: ['innowacje', 'gospodarka'],
      guidance: 'Uwzględnij aktualne dane statystyczne.'
    });

    await waitFor(() => expect(push).toHaveBeenCalledWith('/artykuly/nowy-artykul'));
  });

  it('pokazuje komunikat o niedostępności usługi', async () => {
    mockedCreateArticle.mockRejectedValue(new ServiceUnavailableError(503, 'https://example.com/artykuly'));

    render(<ArticleGeneratorForm rubrics={[]} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Temat artykułu'), 'Temat spełniający wymagania');
    await user.click(screen.getByRole('button', { name: /Wygeneruj artykuł/i }));

    expect(await screen.findByText(/Generowanie artykułu jest chwilowo niedostępne/)).toBeInTheDocument();
  });

  it('prefills video url from search params', () => {
    mockedUseSearchParams.mockReturnValue({ get: (param: string) => (param === 'video_url' ? 'https://test/video' : null) });

    render(<ArticleGeneratorForm rubrics={[]} />);

    expect(screen.getByLabelText('Źródło wideo (opcjonalnie)')).toHaveValue('https://test/video');
  });

  it('przekazuje adres wideo kiedy wprowadzony', async () => {
    const push = jest.fn();
    mockedUseRouter.mockReturnValue({ push });
    mockedCreateArticle.mockResolvedValue({ status: 'published', slug: 'video-article', id: 2 });

    render(<ArticleGeneratorForm rubrics={[]} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Temat artykułu'), 'Analiza wideo');
    await user.type(screen.getByLabelText('Źródło wideo (opcjonalnie)'), 'https://youtube.com/watch?v=abc');
    await user.click(screen.getByRole('button', { name: /Wygeneruj z wideo/i }));

    expect(mockedCreateArticle).toHaveBeenCalledWith({
      topic: 'Analiza wideo',
      rubric_code: undefined,
      keywords: [],
      guidance: undefined,
      video_url: 'https://youtube.com/watch?v=abc'
    });

    await waitFor(() => expect(push).toHaveBeenCalledWith('/artykuly/video-article'));
  });

  it('wyświetla komunikat o braku transkrypcji przy błędzie 422', async () => {
    mockedCreateArticle.mockRejectedValue(
      new ApiError('Unprocessable', 422, 'https://example.com/artykuly', {
        detail: 'Transcript unavailable for this video'
      })
    );

    render(<ArticleGeneratorForm rubrics={[]} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Temat artykułu'), 'Temat spełniający wymagania');
    await user.type(screen.getByLabelText('Źródło wideo (opcjonalnie)'), 'https://youtube.com/watch?v=xyz');
    await user.click(screen.getByRole('button', { name: /Wygeneruj z wideo/i }));

    expect(
      await screen.findByText(
        /To wideo nie ma transkrypcji lub nie jest ona dostępna. Wybierz inne wideo lub spróbuj ponownie później./
      )
    ).toBeInTheDocument();
  });
});
