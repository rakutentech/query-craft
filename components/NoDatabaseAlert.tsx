import React from 'react';
import { Alert, AlertTitle, AlertDescription } from './ui/alert';

interface NoDatabaseAlertProps {
  show: boolean;
}

export const NoDatabaseAlert: React.FC<NoDatabaseAlertProps> = ({ show }) =>
  show ? (
    <Alert variant="destructive" className="mt-4">
      <AlertTitle>No database selected</AlertTitle>
      <AlertDescription>
        Please select a database connection to start querying.
      </AlertDescription>
    </Alert>
  ) : null;
