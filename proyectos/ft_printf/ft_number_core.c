/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   ft_number_core.c                                 :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: max <max@student.42.fr>                  +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/05/24 00:00:00 by max               #+#    #+#             */
/*   Updated: 2026/05/24 00:00:00 by max              ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

#include "ft_printf.h"

static int	ft_num_len(unsigned long n, int base, t_fmt *fmt)
{
	int	len;

	if (fmt->has_precision && fmt->precision == 0 && n == 0)
		return (0);
	len = 1;
	while (n >= (unsigned long)base)
	{
		n = n / base;
		len++;
	}
	return (len);
}

static int	ft_putnum(unsigned long n, int base, int uppercase, int len)
{
	char	buf[32];
	char	*digits;
	int		i;

	if (len == 0)
		return (0);
	if (uppercase)
		digits = "0123456789ABCDEF";
	else
		digits = "0123456789abcdef";
	i = 31;
	buf[i--] = digits[n % base];
	n = n / base;
	while (n > 0)
	{
		buf[i--] = digits[n % base];
		n = n / base;
	}
	return (ft_putstrn(buf + i + 1, len));
}

static int	ft_prefix(char *prefix, int len)
{
	if (len == 0)
		return (0);
	return (ft_putstrn(prefix, len));
}

int	ft_print_number(unsigned long n, t_fmt *fmt, char *prefix, int base)
{
	int	len;
	int	zeros;
	int	spaces;
	int	count;
	int	prefix_len;

	prefix_len = ft_strlen(prefix);
	len = ft_num_len(n, base, fmt);
	zeros = ft_max(fmt->precision - len, 0);
	if (fmt->zero && !fmt->left && !fmt->has_precision)
		zeros = ft_max(fmt->width - prefix_len - len, 0);
	spaces = ft_max(fmt->width - prefix_len - zeros - len, 0);
	count = 0;
	if (!fmt->left)
		count += ft_putnchar(' ', spaces);
	count += ft_prefix(prefix, prefix_len);
	count += ft_putnchar('0', zeros);
	count += ft_putnum(n, base, fmt->spec == 'X', len);
	if (fmt->left)
		count += ft_putnchar(' ', spaces);
	if (count < 0)
		return (-1);
	return (count);
}
