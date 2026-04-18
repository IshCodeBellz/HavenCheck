import React from 'react';
import { ESignature } from '../Common/ESignature';

type SignatureCaptureProps = {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
};

export const SignatureCapture: React.FC<SignatureCaptureProps> = ({ value, onChange, required }) => {
  return <ESignature label="Medication signature" value={value} onChange={onChange} required={required} />;
};
