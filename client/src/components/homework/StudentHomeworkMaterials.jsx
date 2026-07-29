import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useTranslation } from '../../context/LanguageContext';
import EmbeddedYouTube from '../media/EmbeddedYouTube';
import ReadingViewer from '../media/ReadingViewer';
import AppIcon from '../icons/AppIcon';

function MaterialBadge({ name }) {
  return (
    <span className="student-material-badge" aria-hidden>
      <AppIcon name={name} className="w-8 h-8" />
    </span>
  );
}

function HomeworkInlineFile({ homeworkId, attachment }) {
  const { t } = useTranslation();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isImage = attachment.mimeType?.startsWith('image/');
  const isPdf = attachment.mimeType === 'application/pdf';

  useEffect(() => {
    let objectUrl = '';
    setLoading(true);
    setError('');
    api.getHomeworkFileUrl(homeworkId, attachment.id)
      .then((blobUrl) => {
        objectUrl = blobUrl;
        setUrl(blobUrl);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [homeworkId, attachment.id]);

  if (loading) {
    return <div className="student-material-loading">{t('common.loading')}</div>;
  }
  if (error) {
    return <div className="student-material-error">{t('homework.loadFileError')}</div>;
  }
  if (isImage && url) {
    return (
      <ReadingViewer
        url={url}
        isImage
        title={attachment.fileName || t('homework.picture')}
        fullscreenLabel={t('homework.viewPictureFullscreen')}
      />
    );
  }
  if (isPdf && url) {
    return (
      <ReadingViewer
        url={url}
        isPdf
        title={attachment.fileName || t('homework.readingPage')}
        fullscreenLabel={t('homework.readFullscreen')}
      />
    );
  }
  return null;
}

export default function StudentHomeworkMaterials({ homework }) {
  const { t } = useTranslation();
  const videos = homework.videos || [];
  const attachments = homework.attachments || [];
  const images = attachments.filter((a) => a.mimeType?.startsWith('image/'));
  const pdfs = attachments.filter((a) => a.mimeType === 'application/pdf');

  if (!homework.description && videos.length === 0 && attachments.length === 0) {
    return null;
  }

  return (
    <section className="student-hw-materials" aria-label={t('homework.materials')}>
      {homework.description && (
        <div className="student-material-card student-material-intro flex items-start gap-3">
          <MaterialBadge name="clipboard" />
          <p className="student-material-text mb-0">{homework.description}</p>
        </div>
      )}

      {videos.map((video) => (
        <div key={video.id} className="student-material-card student-material-video">
          <div className="student-material-head">
            <MaterialBadge name="film" />
            <p className="student-material-label">
              {video.title && video.title !== 'Watch this' ? video.title : t('homework.watchThis')}
            </p>
          </div>
          <EmbeddedYouTube
            youtubeId={video.youtubeId}
            title={video.title}
          />
        </div>
      ))}

      {images.map((att) => (
        <div key={att.id} className="student-material-card student-material-image">
          <div className="student-material-head">
            <MaterialBadge name="image" />
            <p className="student-material-label">{t('homework.lookAtPicture')}</p>
          </div>
          <HomeworkInlineFile homeworkId={homework.id} attachment={att} />
        </div>
      ))}

      {pdfs.map((att) => (
        <div key={att.id} className="student-material-card student-material-pdf">
          <div className="student-material-head">
            <MaterialBadge name="pdf" />
            <p className="student-material-label">{t('homework.readThisPage')}</p>
          </div>
          <HomeworkInlineFile homeworkId={homework.id} attachment={att} />
        </div>
      ))}
    </section>
  );
}
