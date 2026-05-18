import { getReaderSettingsBootstrapScript } from '@/lib/reader-settings';

export function ReaderSettingsBootstrap(): JSX.Element {
  return (
    <script
      id="reader-settings-bootstrap"
      dangerouslySetInnerHTML={{ __html: getReaderSettingsBootstrapScript() }}
    />
  );
}
