export interface IdGeneratorPort {
  newId(): string;
}

export interface PublicTokenGeneratorPort {
  newToken(): string;
}

export interface ClockPort {
  now(): Date;
}
