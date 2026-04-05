import BasicPaper from './BasicPaper'

interface IProps {
  children: React.ReactNode
}

export default function A4({ children }: IProps) {
  return (
    <BasicPaper width={595} height={842} safeArea={[10, 10, 10, 10]}>
      {children}
    </BasicPaper>
  )
}
