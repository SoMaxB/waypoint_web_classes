/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   ft_output.c                                      :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: max <max@student.42.fr>                  +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/05/24 00:00:00 by max               #+#    #+#             */
/*   Updated: 2026/05/24 00:00:00 by max              ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

#include "ft_printf.h"

int	ft_putnchar(char c, int n)
{
	int	written;

	written = 0;
	while (written < n)
	{
		if (write(1, &c, 1) != 1)
			return (-1);
		written++;
	}
	return (written);
}

int	ft_putstrn(const char *str, int n)
{
	int	written;

	written = 0;
	while (written < n)
	{
		if (write(1, str + written, 1) != 1)
			return (-1);
		written++;
	}
	return (written);
}
