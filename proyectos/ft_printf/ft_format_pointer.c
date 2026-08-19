/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   ft_format_pointer.c                              :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: max <max@student.42.fr>                  +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/05/24 00:00:00 by max               #+#    #+#             */
/*   Updated: 2026/05/24 00:00:00 by max              ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

#include "ft_printf.h"

static int	ft_ptr_len(unsigned long n)
{
	int	len;

	len = 1;
	while (n >= 16)
	{
		n = n / 16;
		len++;
	}
	return (len);
}

static int	ft_putptr_hex(unsigned long n, int len)
{
	char	buf[32];
	char	*digits;
	int		i;

	digits = "0123456789abcdef";
	i = 31;
	buf[i--] = digits[n % 16];
	n = n / 16;
	while (n > 0)
	{
		buf[i--] = digits[n % 16];
		n = n / 16;
	}
	return (ft_putstrn(buf + i + 1, len));
}

static int	ft_ptr_nil(t_fmt *fmt)
{
	int	count;
	int	pad;

	pad = ft_max(fmt->width - 5, 0);
	count = 0;
	if (!fmt->left)
		count += ft_putnchar(' ', pad);
	count += ft_putstrn("(nil)", 5);
	if (fmt->left)
		count += ft_putnchar(' ', pad);
	if (count < 0)
		return (-1);
	return (count);
}

int	ft_format_pointer(void *ptr, t_fmt *fmt)
{
	unsigned long	value;
	int				len;
	int				zeros;
	int				spaces;
	int				count;

	if (!ptr)
		return (ft_ptr_nil(fmt));
	value = (unsigned long)ptr;
	len = ft_ptr_len(value);
	zeros = ft_max(fmt->precision - len, 0);
	if (fmt->zero && !fmt->left && !fmt->has_precision)
		zeros = ft_max(fmt->width - 2 - len, 0);
	spaces = ft_max(fmt->width - 2 - zeros - len, 0);
	count = 0;
	if (!fmt->left)
		count += ft_putnchar(' ', spaces);
	count += ft_putstrn("0x", 2);
	count += ft_putnchar('0', zeros);
	count += ft_putptr_hex(value, len);
	if (fmt->left)
		count += ft_putnchar(' ', spaces);
	if (count < 0)
		return (-1);
	return (count);
}
