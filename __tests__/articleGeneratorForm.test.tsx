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
      guidance: 'Uwzględnij aktualne dane statystyczne.',
      video_url: undefined
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
      rubric_code: null,
      keywords: [],
      guidance: null,
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

  it('pokazuje domyślny komunikat o niedostępności usługi przy błędach 5xx', async () => {
    mockedCreateArticle.mockRejectedValue(new ApiError('Server error', 500, 'https://example.com/artykuly', {}));

    render(<ArticleGeneratorForm rubrics={[]} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Temat artykułu'), 'Stabilny temat');
    await user.click(screen.getByRole('button', { name: /Wygeneruj artykuł/i }));

    expect(
      await screen.findByText(/Generowanie artykułu jest chwilowo niedostępne. Spróbuj ponownie za kilka minut./)
    ).toBeInTheDocument();
  });

  it('zmienia etykietę przy generowaniu z wideo', async () => {
    let resolveRequest: ((value: { status: 'published'; slug: string; id: number }) => void) | null = null;
    mockedCreateArticle.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        })
    );

    render(<ArticleGeneratorForm rubrics={[]} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Temat artykułu'), 'Analiza wideo 2');
    await user.type(screen.getByLabelText('Źródło wideo (opcjonalnie)'), 'https://youtube.com/watch?v=def');

    const submitButton = screen.getByRole('button', { name: /Wygeneruj z wideo/i });
    await user.click(submitButton);

    expect(submitButton).toHaveTextContent('Pobieranie transkrypcji i generowanie…');

    resolveRequest?.({ status: 'published', slug: 'video-article', id: 3 });
  });

  it('ustawia błąd przy polu video_url po błędzie 422 i pozostawia dane', async () => {
    mockedCreateArticle.mockRejectedValue(
      new ApiError('Unprocessable', 422, 'https://example.com/artykuly', {
        detail: 'Only one video_url is supported.'
      })
    );

    render(<ArticleGeneratorForm rubrics={[]} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Temat artykułu'), 'Temat spełniający wymagania');
    await user.type(screen.getByLabelText('Źródło wideo (opcjonalnie)'), ' https://youtube.com/watch?v=xyz ');
    await user.click(screen.getByRole('button', { name: /Wygeneruj z wideo/i }));

    const errors = await screen.findAllByText('Only one video_url is supported.');
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByLabelText('Źródło wideo (opcjonalnie)')).toHaveValue('https://youtube.com/watch?v=xyz');
  });
});
