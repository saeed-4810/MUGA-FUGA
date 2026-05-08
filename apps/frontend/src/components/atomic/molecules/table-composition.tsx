import type { ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";

interface TableCompositionProps {
  children: ReactNode;
  description?: ReactNode;
  title: ReactNode;
}

export const TableComposition = ({ children, description, title }: TableCompositionProps) => (
  <Card>
    <CardHeader>
      <CardTitle className="text-xl">{title}</CardTitle>
      {description ? <CardDescription>{description}</CardDescription> : null}
    </CardHeader>
    <CardContent>{children}</CardContent>
  </Card>
);
