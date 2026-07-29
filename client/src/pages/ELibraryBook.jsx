import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import StudentPageHeader from '../components/student/StudentPageHeader';
import PageHeader from '../components/PageHeader';
import ReadingViewer from '../components/media/ReadingViewer';
import AppIcon from '../components/icons/AppIcon';

function InlineBookReader({ bookId, isPdf, isImage, title }) {
  const { t } = useTranslation();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let objectUrl = '';
    setLoading(true);
    api.getELibraryFileUrl(bookId)
      .then((blobUrl) => {
        objectUrl = blobUrl;
        setUrl(blobUrl);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [bookId]);

  if (loading) return <div className="student-material-loading">{t('elibrary.openingBook')}</div>;
  if (error) return <div className="student-material-error">{error}</div>;
  if (!isPdf && !isImage) return null;

  return (
    <ReadingViewer
      url={url}
      isPdf={isPdf}
      isImage={isImage}
      title={title}
      fullscreenLabel={t('elibrary.readFullscreen')}
    />
  );
}

export default function ELibraryBook() {
  const { campusId, bookId } = useParams();
  const { user } = useAuth();
  const { t } = useTranslation();
  const isStudent = user?.role === 'STUDENT';
  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getELibraryItem(bookId)
      .then(setBook)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [bookId]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !book) {
    return <div className="student-empty-card">{error || t('elibrary.bookNotFound')}</div>;
  }

  return (
    <div className={isStudent ? 'student-page' : ''}>
      {isStudent ? (
        <StudentPageHeader
          icon="book"
          title={book.title}
          subtitle={book.author ? t('common.byAuthor', { author: book.author }) : book.category || t('common.digitalBook')}
          backTo={`/campus/${campusId}/e-library`}
        />
      ) : (
        <PageHeader title={book.title} description={book.author || book.category} />
      )}

      <div className="student-hw-materials">
        {book.description && (
          <div className="student-material-card student-material-intro">
            <p className="student-material-text">{book.description}</p>
          </div>
        )}

        {book.hasFile ? (
          <div className="student-material-card student-material-pdf">
            <div className="student-material-head">
              <span className="student-material-badge" aria-hidden>
                <AppIcon name="book" className="w-8 h-8" />
              </span>
              <p className="student-material-label">Read the book</p>
            </div>
            <InlineBookReader
              bookId={book.id}
              isPdf={book.isPdf}
              isImage={book.isImage}
              title={book.title}
            />
          </div>
        ) : (
          <div className="student-empty-card">
            This book opens in the reading corner soon. Ask your teacher!
          </div>
        )}
      </div>
    </div>
  );
}
