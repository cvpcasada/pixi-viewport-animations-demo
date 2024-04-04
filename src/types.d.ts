declare module "gud" {
  export default function gud(): number;
}

declare module "d-path-parser" {
  export default function parse(
    path: string
  ): { code: string; relative: boolean; end: { x: number; y: number } }[];
}
